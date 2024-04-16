import net from 'net';
import {AfterReceiveStatus, appendCRLF, saveCommandInfoToRecord, tryParseCommand} from './convert';
import {toInt} from './external';
import {
  SaveCommandName,
  SaveStatus,
  StoreApi,
  SaveCommandInfo,
  SaveFunc,
  GetCommandInfo,
  GetCommandName,
  RecordItem,
} from './types';
import {GetResponseInfo} from './types/client';
import {getCommand} from './common';

interface Handler<CommandInfo, ResponseInfo> {
  server: {
    parseCommand: (line: string) => CommandInfo;
    handleCommand: (commandInfo: CommandInfo, store: StoreApi) => string | Buffer;
  };
  client: {
    toCommandLine: (commandInfo: CommandInfo) => string;
    handleResponse: () => (buf: Buffer, socket: net.Socket) => undefined | ResponseInfo;
  };
}

const handlSaveCommand: Handler<SaveCommandInfo, ReturnType<SaveFunc>>['server']['handleCommand'] = (
  commandInfo,
  store
) => {
  const {command, key, value: data = Buffer.alloc(0), bytes} = commandInfo;
  // if (chunk[chunk.byteLength - 1] === 0x0a) {
  //   chunk = chunk.subarray(-1);
  // }
  // if (chunk[chunk.byteLength - 1] === 0x0d) {
  //   chunk = chunk.subarray(-1);
  // }
  // if (commandInfo.value.byteLength < bytes) {
  //   commandInfo.value = Buffer.concat([data, chunk]);
  //   return false;
  // }
  // if (commandInfo.value.byteLength > bytes) {
  //   throw new Error(
  //     `Error, ByteLength, byte is ${bytes}, but actual received ${commandInfo.value.byteLength}`
  //   );
  // }
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
      };
    },
    handleCommand: handlSaveCommand,
  },
  client: {
    toCommandLine(params) {
      const {key, flags, expireTimeInSeconds: exptime, bytes, casId} = params;
      return [key, flags, toInt(exptime), toInt(bytes)].join(' ');
    },
    handleResponse() {
      return chunk => {
        const resStr = chunk.toString() as ReturnType<SaveFunc>;
        return resStr;
      };
      // if (resStr !== SaveStatus.STORED) {
      //   throw new Error(resStr);
      // }
      // return resStr;
    },
  },
};

const getHandler: Handler<GetCommandInfo, GetResponseInfo[]> = {
  server: {
    // get <key>*\r\n
    parseCommand(line: string) {
      const [command, ...keys] = line.split(' ').filter(it => it.length > 0);
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
    toCommandLine(params) {
      const {command, keys} = params;
      const line = [command, ...keys].join(' ');
      return appendCRLF(line);
    },
    // VALUE <key> <flags> <bytes> [<cas unique>]\r\n
    // <data block>\r\n
    // END\r\n
    handleResponse() {
      const results: GetResponseInfo[] = [];
      // function parseFirstLine(line: string): GetResponseInfo {
      //   const [command, key, flags, bytes, casId] = line.split(' ');
      //   return {command: command as GetResponseInfo['command'], key, flags, bytes: toInt(bytes), casId};
      // }

      let commandInfo: GetResponseInfo | null = null;
      // let tmpItem: {item: GetResponseInfo; onReceiveData?: (chunk: Buffer) => false | Buffer} | null = null;
      let cachedBuffer: Buffer | undefined = Buffer.alloc(0);
      let onReceiveDataToCommand: (chunk: Buffer) => AfterReceiveStatus = null;
      const handleData = (chunk: Buffer, socket: net.Socket) => {
        socket.pause();
        if (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
          cachedBuffer = Buffer.concat([cachedBuffer, chunk]);
        } else {
          cachedBuffer = chunk;
        }
        while (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
          if (onReceiveDataToCommand === null) {
            /** start to parse command(first) line */
            const command = getCommand(cachedBuffer);
            const {
              item,
              remainingBuffer: remaining,
              onReceiveData,
            } = tryParseCommand(cachedBuffer, syntax[command].server.parseCommand);
            cachedBuffer = remaining;
            onReceiveDataToCommand = onReceiveData;
            commandInfo = item;
            if (!Boolean(onReceiveData)) {
              if (commandInfo.command === 'END') {
                return results;
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
        // cachedBuf = Buffer.concat([cachedBuf, chunk]);
        // function getItem(data: Buffer): {
        //   item: GetResponseInfo;
        //   remain?: Buffer;
        //   onReceiveData?: (chunk: Buffer) => false | Buffer;
        // } {
        //   const {item, remainingBuffer: remaining, onReceiveData} = tryParseCommand(data, parseFirstLine);
        //   if (item.command === 'VALUE' && onReceiveData) {
        //     const remain = onReceiveData(remaining);
        //     if (remain) {
        //       return {item, remain};
        //     } else {
        //       return {item, onReceiveData};
        //     }
        //   } else {
        //     return {item, onReceiveData};
        //   }
        // }
        // function consume() {
        //   if (cachedBuf.byteLength === 0) {
        //     return false;
        //   }
        //   while (!tmpItem) {
        //     const {item, remain, onReceiveData} = getItem(cachedBuf);
        //     if (item.command === 'END') {
        //       return results;
        //     } else {
        //       if (remain) {
        //         results[item.key] = item;
        //         cachedBuf = remain;
        //       } else {
        //         tmpItem = {item, onReceiveData};
        //       }
        //     }
        //   }
        //   if (tmpItem && cachedBuf.byteLength > 0) {
        //     const {item, onReceiveData} = tmpItem;
        //     while (cachedBuf.byteLength > 0) {
        //       const remain = onReceiveData(cachedBuf);
        //       if (remain) {
        //         cachedBuf = remain;
        //       }
        //     }
        //   }
        //   return false;
        // }
        // return consume();
      };
      return handleData;
    },
  },
};

export const syntax: {
  [command in SaveCommandName | GetCommandName]: Handler<any, any>;
} = {
  set: saveHandler,
  add: saveHandler,
  replace: saveHandler,
  append: saveHandler,
  prepend: saveHandler,
  cas: saveHandler,
  get: getHandler,
};
