import {isNumber, isPlainObject, isString} from '../../../external';
import {Flag} from './types';

export const firstLineReg = /^(set|add|replace|append|prepend|cas|get|gets|delete|VALUE|END)( .*?)?(?: ?\r\n)?$/;

export function getValueFlag(value: any): Flag {
  let flag: Flag = Flag.unknown;
  if (Buffer.isBuffer(value)) {
    flag = Flag.binary;
  } else if (isPlainObject(value)) {
    flag = Flag.json;
  } else if (isString(value)) {
    flag = Flag.string;
  } else if (isNumber(value)) {
    flag = Flag.number;
  }
  return flag;
}

export function getValueByFlag(value: Buffer, flag: Flag) {
  if (flag === Flag.binary) {
    return value;
  }
  const str = value.toString('utf-8');
  if (flag === Flag.number) {
    const num = +str;
    if (isNumber(num)) {
      return num;
    }
  }
  if (flag === Flag.json) {
    let json = str;
    try {
      json = JSON.parse(str);
      return json;
    } catch (err) {
      /** Ignore */
    }
  }
  return str;
}
