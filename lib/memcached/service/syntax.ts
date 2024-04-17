import net from 'net';
import {AfterReceiveStatus, appendCRLF, saveCommandInfoToRecord, tryParseCommand} from './convert';
import {toBuffer, toInt} from './external';
import {SaveCommandName, StoreApi, SaveCommandInfo, SaveFunc, GetCommandInfo, GetCommandName} from './types';
import {GetResponseInfo} from './types/client';
import {DataHandler} from './connection-pool';
import {BufferCRLF} from './constant';

interface Handler<CommandInfo, ResponseInfo> {
  server: {
    parseCommand: (line: string) => CommandInfo;
    handleCommand: (commandInfo: CommandInfo, store: StoreApi) => string | Buffer;
  };
  client: {
    commandInfoToBuffer: (commandInfo: CommandInfo) => Buffer;
    handleResponse: (cb: (error: Error | null, res: ResponseInfo) => void) => DataHandler;
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
      const {key, flags, expireTimeInSeconds: exptime, bytes, casId, value} = params;
      return toBuffer([
        [key, flags, toInt(exptime), toInt(bytes), casId].filter(it => it !== undefined).join(' '),
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
    parseCommand(line: string) {
      const [command, ...keys] = line.split(' ').filter(it => it && it.length > 0);
      return {command: command as GetCommandName, keys};
    },
    // VALUE <key> <flags> <bytes> [<cas unique>]\r\n
    // <data block>\r\n
    // "END\r\n"
    handleCommand(commandInfo, store) {
      const {command, keys} = commandInfo;
      const records = store[command](keys);
      const valueList = Object.entries(records).map(([key, record]) => {
        const {flags, bytes, casId, value} = record;
        const firstLine = ['VALUE', key, flags, bytes, casId].filter(it => it !== undefined).join(' ');
        return [firstLine, value];
      });
      return [...valueList, 'END'].join('\r\n') + '\r\n';
    },
  },
  client: {
    commandInfoToBuffer(params) {
      const {command, keys} = params;
      const line = [command, ...keys].join(' ');
      return toBuffer(appendCRLF(line));
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
            } = tryParseCommand<GetResponseInfo>(cachedBuffer, (line: string) => {
              const [command, key, flags, bytes, casId] = line.split(' ').filter(it => it && it.length > 0);
              return {
                command: command as GetResponseInfo['command'],
                key,
                flags,
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
              }
              results.push(commandInfo);
              // const res = syntax[command].server.handleCommand(item.key, store);
              // socket.write(res);
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

export const syntax = {
  set: saveHandler,
  add: saveHandler,
  replace: saveHandler,
  append: saveHandler,
  prepend: saveHandler,
  cas: saveHandler,
  get: getHandler,
};
