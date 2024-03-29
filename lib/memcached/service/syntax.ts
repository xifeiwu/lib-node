import {toInt, toString} from './external';
import {Command4Set, Params4Cas, Params4Store} from './types';

export type CommandInfo<T> = {
  command: Command4Set;
  /** received data on server side, or... */
  value?: Buffer;
} & T;

interface Handler<Params = object> {
  lineToParams: (line: string) => Params;
  serverOnData: (data: Buffer, options: CommandInfo<Params>) => boolean;
  paramsToLine: (params: object) => string;
}

function serverOnData(chunk: Buffer, commandInfo: CommandInfo<Params4Store>) {
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

//<cmd> <key> <flags> <exptime> <bytes>
const handler4Update: Handler<Params4Store> = {
  lineToParams(line: string): Params4Store {
    const [key, flags, exptime, bytes] = line.split(' ');
    return {
      key,
      flags,
      expireTimeInSeconds: toString(exptime),
      bytes: toString(bytes),
    };
  },
  serverOnData,
  paramsToLine(params: Params4Store) {
    const {key, flags, expireTimeInSeconds: exptime, bytes} = params;
    return [key, flags, toInt(exptime), toInt(bytes)].join(' ');
  },
};

//<cmd> <key> <flags> <exptime> <bytes> <cas unique>
const handler4Cas: Handler = {
  lineToParams(line: string): Params4Cas {
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
  paramsToLine(params: Params4Cas) {
    const {key, flags, expireTimeInSeconds: exptime, bytes, casId} = params;
    return [key, flags, toInt(exptime), toInt(bytes), casId].join(' ');
  },
};

export const syntax: {
  [command in Command4Set]: Handler;
} = {
  set: handler4Update,
  add: handler4Update,
  replace: handler4Update,
  append: handler4Update,
  prepend: handler4Update,
  cas: handler4Cas,
};
