import {Readable} from 'stream';
import {isStream} from './common';
import {getStreamData} from './stream';
import {isNumber, isPlainObject, isString} from './fe';

type CanConvertToBuffer = string | number | object | Readable | Uint8Array;
export async function toBuffer(data: CanConvertToBuffer | Array<CanConvertToBuffer>) {
  if (Array.isArray(data)) {
    return Buffer.concat(await Promise.all(data.map(toBuffer)));
  }
  let buffer: Buffer = Buffer.alloc(0);
  if (isStream(data)) {
    buffer = Buffer.from(await getStreamData(data as Readable));
  } else if (isPlainObject(data)) {
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
