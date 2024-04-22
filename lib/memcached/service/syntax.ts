import net from 'net';
import {AfterReceiveStatus, appendCRLF, saveCommandInfoToRecord, tryParseCommand} from './convert';
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
    parseCommand: (line: string) => CommandInfo;
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

const handlSaveCommand: Handler<SaveCommandInfo, ReturnType<SaveFunc>>['server']['handleCommand'] = (
  commandInfo,
  store
) => {
  const {command, key} = commandInfo;
  const saveRes = store[command](key, saveCommandInfoToRecord(commandInfo));
  return appendCRLF(saveRes);
};

//<cmd> <key> <flags> <exptime> <bytes>
//<cmd> <key> <flags> <exptime> <bytes> <cas unique>
const saveHandler: Handler<SaveCommandInfo, ReturnType<SaveFunc>> = {
  server: {
    parseCommand(line: string) {
      const [command, key, flags, exptime, bytes, casId] = line.split(' ');
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

const getHandler: Handler<GetCommandInfo, GetResponseInfo[]> = {
  server: {
    // get <key>*\r\n
    parseCommand(firstLine: string) {
      const execRes = firstLineReg.exec(firstLine);
      if (!execRes) {
        throw new Error(`Error, Command Format: ${firstLine}`);
      }
      const [, command, props] = execRes;
      const keys = props.split(' ').filter(it => it && it.length > 0);
      return {command: command as GetCommandName, keys};
    },
    // VALUE <key> <flags> <bytes> [<cas unique>]\r\n
    // <data block>\r\n
    // "END\r\n"
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
    // VALUE <key> <flags> <bytes> [<cas unique>]\r\n
    // <data block>\r\n
    // END\r\n
    handleResponse(cb) {
      const results: GetResponseInfo[] = [];
      let commandInfo: GetResponseInfo | null = null;
      // let cachedBuffer: Buffer | undefined = Buffer.alloc(0);
      let onReceiveDataToCommand: (chunk: Buffer) => AfterReceiveStatus = null;
      const handleData: DataHandler = (chunk: Buffer, socket: net.Socket) => {
        socket.pause();
        // if (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
        //   cachedBuffer = Buffer.concat([cachedBuffer, chunk]);
        // } else {
        //   cachedBuffer = chunk;
        // }
        let done = false;
        let cachedBuffer = chunk;
        while (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
          if (onReceiveDataToCommand === null) {
            /** start to parse command(first) line */
            // const command = getCommand(cachedBuffer);
            const {
              item,
              remainingBuffer: remaining,
              onReceiveData,
            } = tryParseCommand<GetResponseInfo>(cachedBuffer, (firstLine: string) => {
              const execRes = firstLineReg.exec(firstLine);
              if (!execRes) {
                throw new Error(`Error, Command Format: ${firstLine}`);
              }
              const [, command, props] = execRes;
              const [key, flags, bytes, casId] = (props ?? '').split(' ').filter(it => it && it.length > 0);
              return {
                command: command as GetResponseInfo['command'],
                key,
                flags: flags as Flag,
                bytes: toInt(bytes),
                casId,
              };
            });
            cachedBuffer = remaining;
            onReceiveDataToCommand = onReceiveData;
            commandInfo = item;
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
            const {remainingBuffer, needConsume} = onReceiveDataToCommand(cachedBuffer);
            cachedBuffer = remainingBuffer;
            if (!needConsume) {
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
    parseCommand(firstLine) {
      const execRes = firstLineReg.exec(firstLine);
      if (!execRes) {
        throw new Error(`Error, Command Format: ${firstLine}`);
      }
      const [, command, props] = execRes;
      const keys = props.split(' ').filter(it => it && it.length > 0);
      return {command: command as 'delete', key: keys[0]};
    },
    handleCommand(commandInfo, store) {
      const {command, key, noreply} = commandInfo;
      const res = store[command](key);
      if (noreply === undefined) {
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
