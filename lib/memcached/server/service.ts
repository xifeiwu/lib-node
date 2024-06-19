import {syntax} from '../service';
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

export function stringifyRecordItem(item: RecordItem) {
  const {value, ...rest} = item;
  return {
    ...rest,
    value: Buffer.isBuffer(value) ? value.toString() : value,
  };
}
