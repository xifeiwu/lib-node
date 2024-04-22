import {BufferCRLF, CRLF, MAX_RELATIVE_SECONDS} from './constant';
import {isString} from './external';
import {RecordItem, Flag, SaveCommandInfo, GeneralCommandInfo} from './types';

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
    value,
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

export interface AfterConsumeDataStatus {
  remainingBuffer?: Buffer;
  onReceiveData?: (chunk: Buffer) => AfterReceiveDataStatus;
}
export function tryConsumeData(item: GeneralCommandInfo, chunk: Buffer): AfterConsumeDataStatus {
  const results: AfterConsumeDataStatus = {
    remainingBuffer: chunk,
  };
  const {bytes = 0} = item;
  if (bytes > 0 && Buffer.isBuffer(chunk) && chunk.byteLength > 0) {
    item.value = Buffer.alloc(0);
    const {remainingBuffer, needContinueConsume} = onReceiveData(item, chunk);
    results.remainingBuffer = remainingBuffer;
    if (needContinueConsume) {
      results.onReceiveData = onReceiveData.bind(item);
    }
  }
  return results;
}

export interface AfterReceiveDataStatus {
  consumedLength: number;
  needContinueConsume: boolean;
  remainingBuffer?: Buffer;
}
/**
 * @param item
 * @param chunk
 * @returns
 * consumeLength: how many bytes consumed on this time
 * remainingBuffer: remaining buffer
 */
function onReceiveData(item: GeneralCommandInfo, chunk: Buffer): AfterReceiveDataStatus {
  const needConsume = () => (item.value ? item.value.byteLength : 0) < item.bytes;
  const results: AfterReceiveDataStatus = {
    consumedLength: 0,
    needContinueConsume: needConsume(),
    remainingBuffer: chunk,
  };
  if (!Buffer.isBuffer(chunk) || chunk.byteLength === 0) {
    results.remainingBuffer = undefined;
  } else {
    const {bytes, value = Buffer.alloc(0)} = item;
    const lengthNeedToConsume = bytes - value.byteLength;
    if (chunk.byteLength < lengthNeedToConsume) {
      item.value = Buffer.concat([value, chunk]);
      results.consumedLength = chunk.byteLength;
      results.needContinueConsume = needConsume();
      results.remainingBuffer = undefined;
    } else {
      item.value = Buffer.concat([value, chunk.subarray(0, lengthNeedToConsume)]);
      chunk = chunk.subarray(lengthNeedToConsume);
      if (chunk[0] === 0x0d) {
        chunk = chunk.subarray(1);
      }
      if (chunk[0] === 0x0a) {
        chunk = chunk.subarray(1);
      }
      results.consumedLength = lengthNeedToConsume;
      results.needContinueConsume = needConsume();
      results.remainingBuffer = chunk;
    }
  }
  return results;
}
