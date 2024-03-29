import {appendCRLF, commandInfoToRecord} from '.';
import {toInt, toString} from './external';
import {Command4Get, Command4Store, Params4Cas, Params4Store, StoreApi} from './types';

export type CommandInfo<CommandCategory extends Command4Store | Command4Get, T> = {
  command: CommandCategory;
  /** received data on server side, or... */
  value?: Buffer;
} & T;

interface Handler<CommandCategory extends Command4Store | Command4Get, Params = object> {
  lineToParams: (line: string) => Params;
  serverOnData: (data: Buffer, options: CommandInfo<CommandCategory, Params>) => boolean;
  serverResponse: (store: StoreApi, commandInfo: CommandInfo<CommandCategory, Params>) => Buffer | string;
  paramsToLine: (params: Params) => string;
}

function serverOnData(chunk: Buffer, commandInfo: CommandInfo<Command4Store, Params4Store>) {
  const {value: data = Buffer.alloc(0), bytes} = commandInfo;
  if (chunk[chunk.byteLength - 1] === 0x0a) {
    chunk = chunk.subarray(-1);
  }
  if (chunk[chunk.byteLength - 1] === 0x0d) {
    chunk = chunk.subarray(-1);
  }
  if (commandInfo.value.byteLength < bytes) {
    commandInfo.value = Buffer.concat([data, chunk]);
    return false;
  }
  if (commandInfo.value.byteLength > bytes) {
    throw new Error(
      `Error, ByteLength, byte is ${bytes}, but actual received ${commandInfo.value.byteLength}`
    );
  }
  return true;
}
const serverResponse: Handler<Command4Store, Params4Store | Params4Cas>['serverResponse'] = (
  store,
  commandInfo
) => {
  let response: string | null = null;
  const {command, key, bytes} = commandInfo;
  // if (isNumber(bytes) && commandInfo.bytes > 0) {
  response = store[command](key, commandInfoToRecord(commandInfo));
  return appendCRLF(response);
};

//<cmd> <key> <flags> <exptime> <bytes>
const handler4Update: Handler<Command4Store, Params4Store> = {
  lineToParams(line: string) {
    const [key, flags, exptime, bytes] = line.split(' ');
    return {
      key,
      flags,
      expireTimeInSeconds: toString(exptime),
      bytes: toString(bytes),
    };
  },
  serverOnData,
  serverResponse,
  paramsToLine(params) {
    const {key, flags, expireTimeInSeconds: exptime, bytes} = params;
    return [key, flags, toInt(exptime), toInt(bytes)].join(' ');
  },
};

//<cmd> <key> <flags> <exptime> <bytes> <cas unique>
const handler4Cas: Handler<Command4Store, Params4Cas> = {
  lineToParams(line: string) {
    const [key, flags, exptime, bytes, casId] = line.split(' ');
    return {
      key,
      flags,
      expireTimeInSeconds: toString(exptime),
      bytes: toString(bytes),
      casId,
    };
  },
  serverOnData,
  serverResponse,
  paramsToLine(params) {
    const {key, flags, expireTimeInSeconds: exptime, bytes, casId} = params;
    return [key, flags, toInt(exptime), toInt(bytes), casId].join(' ');
  },
};

interface Params4Get {
  keys: string[];
}
const handler4Get: Handler<Command4Get, Params4Get> = {
  lineToParams(line: string) {
    const keys = line.split(' ').filter(it => it.length > 0);
    return {keys};
  },
  serverOnData() {
    return true;
  },
  serverResponse(store, commandInfo) {
    const {command, keys} = commandInfo;
    const records = store[command](keys);
    return `commandInfoToRecord(commandInfo)`;
  },

  paramsToLine(params) {
    const {keys} = params;
    return keys.join(' ');
  },
};

export const syntax: {
  [command in Command4Store | Command4Get]: Handler<Command4Store | Command4Get>;
} = {
  set: handler4Update,
  add: handler4Update,
  replace: handler4Update,
  append: handler4Update,
  prepend: handler4Update,
  cas: handler4Cas,
  get: handler4Get,
};
