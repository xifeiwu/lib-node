import net from 'net';
import {AfterReceiveDataStatus, saveCommandInfoToRecord, tryConsumeData} from './convert';
import {toBuffer, toInt} from './external';
import {
  SaveCommandName,
  StoreApi,
  SaveCommandInfo,
  SaveFunc,
  GetCommandInfo,
  GetCommandName,
  Flag,
  DeleteCommandInfo,
  DeleteFunc,
  DeleteResponseStatus,
} from './types';
import {DataHandler, GetResponseInfo} from './types/client';
import {BufferCRLF} from './constant';
import {firstLineReg} from './common';

interface Handler<CommandInfo, ResponseInfo> {
  server: {
    toCommandInfo: (items: string[]) => CommandInfo;
    handleCommand: (commandInfo: CommandInfo, store: StoreApi) => string | Buffer | undefined;
  };
  client: {
    commandInfoToBuffer: (commandInfo: CommandInfo) => Buffer;
    handleResponse: (
      cb: (error: Error | null, res: ResponseInfo) => void,
      commandInfo: CommandInfo
    ) => DataHandler;
  };
}

export function parseFirstLine(chunk: Buffer) {
  const index = chunk.findIndex((it, index) => {
    return it === 0x0d && chunk[index + 1] === 0x0a;
  });
  if (index === -1) {
    throw new Error('Error tryParseCommandLine: \r\n not found when parsing command line');
  }
  const firstLine = chunk.subarray(0, index + 2).toString('utf-8');
  const execResults = firstLineReg.exec(firstLine);
  if (!execResults) {
    throw new Error(`Error format of command not correct: ${firstLine}`);
  }
  const [, command, rest] = execResults;
  const props = rest ? rest.split(' ').filter(it => it && it.length > 0) : [];
  return {
    commandItems: [command, ...props],
    remainingBuffer: chunk.subarray(index + 2),
  };
}

const handlSaveCommand: Handler<SaveCommandInfo, ReturnType<SaveFunc>>['server']['handleCommand'] = (
  commandInfo,
  store
) => {
  const {command, key} = commandInfo;
  const saveRes = store[command](key, saveCommandInfoToRecord(commandInfo));
  return toBuffer([saveRes, BufferCRLF]);
};

//<cmd> <key> <flags> <exptime> <bytes>
//<cmd> <key> <flags> <exptime> <bytes> <cas unique>
const saveHandler: Handler<SaveCommandInfo, ReturnType<SaveFunc>> = {
  server: {
    toCommandInfo(items) {
      const [command, key, flags, exptime, bytes, casId] = items;
      return {
        command: command as SaveCommandName,
        key,
        flags,
        expireTimeInSeconds: toInt(exptime),
        bytes: toInt(bytes),
        casId,
        value: Buffer.alloc(0),
      };
    },
    handleCommand: handlSaveCommand,
  },
  client: {
    commandInfoToBuffer(params) {
      const {command, key, flags, expireTimeInSeconds: exptime, bytes, casId, value} = params;
      return toBuffer([
        [command, key, flags, toInt(exptime), toInt(bytes), casId].filter(it => it !== undefined).join(' '),
        BufferCRLF,
        value,
        BufferCRLF,
      ]);
    },
    handleResponse(cb) {
      return async chunk => {
        const resStr = chunk.toString() as ReturnType<SaveFunc>;
        cb(null, resStr);
        return {done: true};
      };
    },
  },
};

// get <key>*\r\n
// VALUE <key> <flags> <bytes> [<cas unique>]\r\n
// <data block>\r\n
// "END\r\n"
const getHandler: Handler<GetCommandInfo, GetResponseInfo[]> = {
  server: {
    toCommandInfo(items) {
      const [command, ...keys] = items;
      return {command: command as GetCommandName, keys};
    },
    handleCommand(commandInfo, store) {
      const {command, keys} = commandInfo;
      const records = store['gets'](keys);
      const valueList = Object.entries(records).map<Buffer>(([key, record]) => {
        const {flags, bytes, casId, value} = record;
        const firstLine = ['VALUE', key, flags, bytes, casId].filter(it => it !== undefined).join(' ');
        return toBuffer([firstLine, BufferCRLF, value, BufferCRLF]);
      });
      return toBuffer([...valueList, toBuffer(['END', BufferCRLF])]);
    },
  },
  client: {
    commandInfoToBuffer(params) {
      const {command, keys} = params;
      const line = [command, ...keys].join(' ');
      return toBuffer([line, BufferCRLF]);
    },
    handleResponse(cb) {
      const results: GetResponseInfo[] = [];
      let commandInfo: GetResponseInfo | null = null;
      let onReceiveDataToCommand: (chunk: Buffer) => AfterReceiveDataStatus = null;
      const handleData: DataHandler = (chunk: Buffer, socket: net.Socket) => {
        socket.pause();
        // if (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
        //   cachedBuffer = Buffer.concat([cachedBuffer, chunk]);
        // } else {
        //   cachedBuffer = chunk;
        // }
        let done = false;
        /** Combine remaining buffer with current chunk is done from outside by caller */
        let cachedBuffer = chunk;
        while (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
          if (!onReceiveDataToCommand) {
            /** start to parse command(first) line */
            const {commandItems, remainingBuffer: restBuffer} = parseFirstLine(cachedBuffer);
            // const [commandName] = commandItems;
            // commandInfo = syntax[commandName].server.toCommandInfo(commandItems);
            const [command, key, flags, bytes, casId] = commandItems;
            commandInfo = {
              command: command as GetResponseInfo['command'],
              key,
              flags: flags as Flag,
              bytes: toInt(bytes),
              casId,
            };
            const {remainingBuffer, onReceiveData} = tryConsumeData(commandInfo, restBuffer);
            cachedBuffer = remainingBuffer;
            onReceiveDataToCommand = onReceiveData;
            if (!Boolean(onReceiveData)) {
              if (commandInfo.command === 'END') {
                // return results;
                cb(null, results);
                done = true;
              } else {
                results.push(commandInfo);
              }
            }
          } else {
            const {remainingBuffer, needContinueConsume} = onReceiveDataToCommand(cachedBuffer);
            cachedBuffer = remainingBuffer;
            if (!needContinueConsume) {
              results.push(commandInfo);
              onReceiveDataToCommand = null;
            }
          }
        }
        socket.resume();
        return {done, cachedBuffer};
      };
      return handleData;
    },
  },
};

/**
Deletion
--------
The command "delete" allows for explicit deletion of items:
delete <key> [noreply]\r\n
- <key> is the key of the item the client wishes the server to delete
- "noreply" optional parameter instructs the server to not send the
  reply.  See the note in Storage commands regarding malformed
  requests.
The response line to this command can be one of:
- "DELETED\r\n" to indicate success
- "NOT_FOUND\r\n" to indicate that the item with this key was not
  found.
See the "flush_all" command below for immediate invalidation
of all existing items.ss
 */
const deleteHandler: Handler<DeleteCommandInfo, void> = {
  server: {
    toCommandInfo(items) {
      const [command, key, noreply] = items;
      return {command: command as 'delete', key, noreply: noreply !== undefined};
    },
    handleCommand(commandInfo, store) {
      const {command, key, noreply} = commandInfo;
      const res = store[command](key);
      if (!noreply) {
        return res;
      }
      return undefined;
    },
  },
  client: {
    commandInfoToBuffer(commandInfo) {
      const {command, key, noreply} = commandInfo;
      return toBuffer([[command, key, noreply].filter(it => !!it).join(' '), BufferCRLF]);
    },
    handleResponse(cb, commandInfo) {
      const {noreply} = commandInfo;
      if (noreply === undefined) {
        return async chunk => {
          const resStr = chunk.toString() as ReturnType<DeleteFunc['delete']>;
          let error = resStr === DeleteResponseStatus.DELETED ? null : new Error(resStr);
          cb(error);
          return {done: true};
        };
      } else {
        cb(null);
      }
    },
  },
};
export const syntax = {
  set: saveHandler,
  add: saveHandler,
  replace: saveHandler,
  append: saveHandler,
  prepend: saveHandler,
  cas: saveHandler,
  gets: getHandler,
  get: getHandler,
  delete: deleteHandler,
};
