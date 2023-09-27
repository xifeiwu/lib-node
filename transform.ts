import {Readable} from 'stream';
import {isStream} from './common';
import {getStreamData} from './stream';
import {isPlainObject} from './fe';

export async function toBuffer(data: string | object | Readable | Uint8Array) {
  const bufferList: Buffer[] = [];
  if (data) {
    let payload: Buffer | string = data as Buffer | string;
    if (isStream(payload)) {
      payload = await getStreamData(data as Readable);
    } else if (isPlainObject(data)) {
      payload = JSON.stringify(data);
    }

    bufferList.push(Buffer.from(payload));
  }
  return Buffer.concat(bufferList);
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
