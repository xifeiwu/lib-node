import {BufferCRLF, CRLF, MAX_RELATIVE_SECONDS} from './constant';
import {isString} from './external';
import {CommandInfo, SaveParams, CasParams, RecordItem, SaveCommandName, Flag} from './types';

/**
 * Convert timeInSeconds to Expiration(timestamp)
 * @param timeInSeconds
 * @returns
 */
export function toExpiration(timeInSeconds: number) {
  if (timeInSeconds === 0) {
    return timeInSeconds;
  }
  const milliSeconds = 1000 * timeInSeconds;
  if (timeInSeconds < MAX_RELATIVE_SECONDS) {
    return Date.now() + milliSeconds;
  }
  return milliSeconds;
}

export function saveCommandInfoToRecord(commandInfo: CommandInfo<SaveCommandName, SaveParams | CasParams>) {
  const {flags, expireTimeInSeconds, bytes, casId, value} = commandInfo as CommandInfo<
    SaveCommandName,
    CasParams
  >;
  const record: RecordItem = {
    flags: flags as unknown as Flag,
    expiration: toExpiration(expireTimeInSeconds),
    bytes,
    casId,
    value: value.toString('utf-8'),
  };
  return record;
}

export function appendCRLF(data: string): string;
export function appendCRLF(data: Buffer): Buffer;
export function appendCRLF(data: string | Buffer) {
  if (isString(data)) {
    if ((data as string).endsWith(CRLF)) {
      data = (data as string) + CRLF;
    }
  } else if (Buffer.isBuffer(data)) {
    const length = (data as Buffer).byteLength;
    if ((data as Buffer)[length - 2] !== BufferCRLF[0] || (data as Buffer)[length - 1] !== BufferCRLF[1]) {
      data = Buffer.concat([data as Buffer, BufferCRLF]);
    }
  }
  return data;
}
export function removeCRLF(data: string | Buffer) {
  if (isString(data)) {
    if ((data as string).endsWith(CRLF)) {
      data = data.slice(-2);
    }
  }
  if (Buffer.isBuffer(data)) {
    const length = (data as Buffer).byteLength;
    if ((data as Buffer)[length - 2] !== BufferCRLF[0] || (data as Buffer)[length - 1] !== BufferCRLF[1]) {
      data = data.subarray(-2);
    }
  }
  return data;
}

interface BytesAndValue {
  bytes: number;
  value?: Buffer;
}
export function tryParseCommandLine<T extends BytesAndValue>(
  chunk: Buffer,
  parserFunc: (line: string) => T
): {
  item: T;
  remaining: Buffer;
  onReceiveData?: (chunk: Buffer) => false | Buffer;
} {
  const index = chunk.findIndex((it, index) => {
    return it === 0x0d && chunk[index + 1] === 0x0a;
  });
  if (index === -1) {
    throw new Error('Error tryParseCommandLine: \r\n not found on command line');
  }
  const firstLine = chunk.subarray(0, index).toString('utf-8');
  const remaining = chunk.subarray(index + 2);
  const item = parserFunc(firstLine);
  const {bytes = 0} = item;
  return {item, remaining, onReceiveData: bytes === 0 ? undefined : onReceiveData.bind(item)};
}
/**
 * @param item
 * @param chunk
 * @returns false means after append chunk to value, value length still less than bytes
 */
function onReceiveData(item: BytesAndValue, chunk: Buffer) {
  if (!Buffer.isBuffer(chunk) || chunk.byteLength === 0) {
    return false;
  }
  const {bytes, value = Buffer.alloc(0)} = item;
  if (chunk.byteLength < bytes) {
    item.value = Buffer.concat([value, chunk]);
    return false;
  }
  const remainingLength = bytes - value.byteLength;
  item.value = Buffer.concat([value, chunk.subarray(0, remainingLength)]);
  chunk = chunk.subarray(remainingLength);
  if (chunk[0] === 0x0d) {
    chunk = chunk.subarray(1);
  }
  if (chunk[1] === 0x0a) {
    chunk = chunk.subarray(1);
  }
  return chunk;
}
