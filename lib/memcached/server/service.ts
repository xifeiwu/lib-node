import {syntax} from '../service';
import {fromBuffer, isNumber} from '../service/external';
import {ErrorMessage, ErrorStatus, RecordItem} from '../service/types';

export function getError(errorType: ErrorStatus, message: string = ''): ErrorMessage {
  return `${errorType} ${message}`;
}

const firstLineReg = /^(\w+) (.*?)(?: ?\r\n)?$/;
export function parseCommandLine(line: string) {
  const result = firstLineReg.exec(line);
  if (!result) {
    throw new Error(`Regexp Match Fail: ${line}`);
  }
  const [command, paramsStr] = result.slice(1, 3);
  if (!Object.prototype.hasOwnProperty.call(syntax, command)) {
    throw new Error(`Error, command not support: ${command}`);
  }
  const params = syntax[command].lineToParams(paramsStr);
  return {
    command,
    ...params,
  };
}

export function isOutdate(expiration: number) {
  if (!isNumber(expiration)) {
    return true;
  }
  if (expiration > 0 && expiration < Date.now()) {
    return true;
  }
  return false;
}
export function stringifyRecordItem(item: RecordItem) {
  const {value, expiration, ...rest} = item;
  return {
    ...rest,
    outdate: isOutdate(expiration),
    expiration,
    value: fromBuffer(value, 'json') as object,
  };
}
