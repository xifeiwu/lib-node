import {BufferCRLF, CRLF, MAX_RELATIVE_SECONDS} from './constant';
import {isString} from './external';
import {CommandInfo} from './syntax';
import {Flag, Params4Cas, Params4Store, RecordItem} from './types';

export * from './constant';
export * from './syntax';
export * from './external';
export * from './types';

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

export function commandInfoToRecord(commandInfo: CommandInfo<Params4Store> | CommandInfo<Params4Cas>) {
  const {flags, expireTimeInSeconds, bytes, casId, value} = commandInfo as CommandInfo<Params4Cas>;
  const record: RecordItem = {
    flags: flags as unknown as Flag,
    expiration: toExpiration(expireTimeInSeconds),
    bytes,
    casId,
    value: value.toString('utf-8'),
  };
  return record;
}

export function recordToLines(record: RecordItem) {
  const {} = 

}
export function appendCRLF(data: string | Buffer) {
  if (isString(data)) {
    if ((data as string).endsWith(CRLF)) {
      data = data + CRLF;
    }
  }
  if (Buffer.isBuffer(data)) {
    const length = (data as Buffer).byteLength;
    if ((data as Buffer)[length - 2] !== BufferCRLF[0] || (data as Buffer)[length - 1] !== BufferCRLF[1]) {
      data = Buffer.concat([data, BufferCRLF]);
    }
  }
  return data;
}
