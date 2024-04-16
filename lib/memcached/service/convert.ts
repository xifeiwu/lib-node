import {BufferCRLF, CRLF, MAX_RELATIVE_SECONDS} from './constant';
import {isString} from './external';
import {RecordItem, Flag, SaveCommandInfo} from './types';

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

export function saveCommandInfoToRecord(commandInfo: SaveCommandInfo) {
  const {flags, expireTimeInSeconds, bytes, casId, value} = commandInfo;
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

export function removeCRLF(data: string): string;
export function removeCRLF(data: Buffer): Buffer;
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

/** for save */

interface BytesAndValue {
  bytes?: number;
  value?: Buffer;
}
export const firstLineReg = /^(\w+) (.*?)(?: ?\r\n)?$/;
export function tryParseCommand<T extends BytesAndValue>(
  chunk: Buffer,
  parserFirstLine: (line: string) => T
): {
  item: T;
  remainingBuffer?: Buffer;
  /** onReceiveData is not undefined means item still need to consume some data */
  onReceiveData: ((chunk: Buffer) => AfterReceiveStatus);
} {
  const index = chunk.findIndex((it, index) => {
    return it === 0x0d && chunk[index + 1] === 0x0a;
  });
  if (index === -1) {
    throw new Error('Error tryParseCommandLine: \r\n not found when parsing command line');
  }
  const firstLine = chunk.subarray(0, index).toString('utf-8');
  if (!firstLineReg.test(firstLine)) {
    throw new Error(`Error format of command not correct: ${firstLine}`);
  }
  let remainingBuffer = chunk.subarray(index + 2);
  const commandInfo = parserFirstLine(firstLine);
  const {bytes = 0} = commandInfo;
  /** Only for save */
  let notNeedConsumeData = bytes === 0;
  if (bytes > 0 && remainingBuffer.byteLength > 0) {
    remainingBuffer = tryConsumeAllBuffer(commandInfo, remainingBuffer);
    notNeedConsumeData = commandInfo.bytes === commandInfo.value.byteLength;
  }
  return {
    item: commandInfo,
    remainingBuffer,
    onReceiveData: notNeedConsumeData ? null : onReceiveData.bind(commandInfo),
  };
}

function tryConsumeAllBuffer(item: BytesAndValue, chunk: Buffer): Buffer {
  const {bytes = 0} = item;
  if (bytes === 0) {
    return chunk;
  }
  if (!Buffer.isBuffer(chunk) || chunk.byteLength === 0) {
    return undefined;
  }
  item.value = Buffer.alloc(0);
  while (item.value.length < bytes && Buffer.isBuffer(chunk) && chunk.byteLength > 0) {
    const {remainingBuffer} = onReceiveData(item, chunk);
    chunk = remainingBuffer;
  }
  return chunk;
}

export interface AfterReceiveStatus {
  consumeLength: number;
  needConsume: boolean;
  remainingBuffer?: Buffer;
}
/**
 * @param item
 * @param chunk
 * @returns
 * consumeLength: how many bytes consumed on this time
 * remainingBuffer: remaining buffer
 */
function onReceiveData(item: BytesAndValue, chunk: Buffer): AfterReceiveStatus {
  const needConsume = () => (item.value ? item.value.byteLength : 0) <= item.bytes;
  if (!Buffer.isBuffer(chunk) || chunk.byteLength === 0) {
    return {consumeLength: 0, needConsume: needConsume()};
  }
  const {bytes, value = Buffer.alloc(0)} = item;
  const lengthNeedToConsume = bytes - value.byteLength;
  if (chunk.byteLength < lengthNeedToConsume) {
    item.value = Buffer.concat([value, chunk]);
    return {consumeLength: chunk.byteLength, needConsume: needConsume()};
  }
  item.value = Buffer.concat([value, chunk.subarray(0, lengthNeedToConsume)]);
  chunk = chunk.subarray(lengthNeedToConsume);
  if (chunk[0] === 0x0d) {
    chunk = chunk.subarray(1);
  }
  if (chunk[1] === 0x0a) {
    chunk = chunk.subarray(1);
  }

  return {
    consumeLength: lengthNeedToConsume,
    needConsume: needConsume(),
    remainingBuffer: chunk.byteLength >= 0 ? chunk : undefined,
  };
}
