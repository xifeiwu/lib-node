import {Readable} from 'stream';
import {isStream} from './common';
import {getStreamData} from './stream';
import {isNumber, isPlainObject, isString} from './fe';

type CanConvertToBuffer = string | number | object | Uint8Array;
export function toBuffer(data: CanConvertToBuffer | Array<CanConvertToBuffer>) {
  if (Array.isArray(data)) {
    if (data.every(isNumber)) {
      return Buffer.from(data as Array<number>);
    }
    const bufAll = data.map(toBuffer);
    return Buffer.concat(bufAll);
  }
  let buffer: Buffer = Buffer.alloc(0);
  if (isPlainObject(data)) {
    buffer = Buffer.from(JSON.stringify(data));
  } else if (isString(data)) {
    buffer = Buffer.from(data as string);
  } else if (isNumber(data)) {
    buffer = Buffer.from([data as number]);
  } else if (Buffer.isBuffer(data)) {
    buffer = data;
  }
  return buffer;
}

export function fromBuffer(buffer: Buffer, dataType: 'json' | 'string' | 'buffer') {
  if (!dataType) {
    return buffer;
  }
  let finalData: Buffer | string | object = buffer;
  if (dataType === 'json') {
    finalData = buffer.toString();
    try {
      finalData = JSON.parse(finalData);
    } catch (err) {
      /** parse Error */
    }
  } else if (dataType === 'string') {
    finalData = buffer.toString();
  }
  return finalData;
}
