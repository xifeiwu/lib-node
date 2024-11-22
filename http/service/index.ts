
import {IncomingMessage} from 'http';
import {CanConvertToBuffer, HttpResponseInfo} from '../../types';
import {isPlainObject} from '../../external';
import {Readable} from 'stream';

export function convertKeyToLowerCase<T extends object>(obj: T) {
  return Object.entries(obj).reduce<T>((sum, [key, value]) => {
    return {
      ...sum,
      [key.toLocaleLowerCase()]: value,
    };
  }, {} as T);
}

export async function getIncomingMessageData(incomingMessage: IncomingMessage) {
  const {headers} = incomingMessage;
  const contentLength = parseInt(headers['content-length']);
  let resolved = false;
  return new Promise<Buffer>((res, rej) => {
    let byteLength = 0;
    const bufferList: Buffer[] = [];
    incomingMessage.on('data', (chunk: Buffer) => {
      if (resolved) {
        return;
      }
      bufferList.push(chunk);
      byteLength += chunk.byteLength;
      if (!Number.isNaN(contentLength) && byteLength >= contentLength) {
        resolved = true;
        res(Buffer.concat(bufferList).subarray(0, contentLength));
      }
    });
    incomingMessage.on('end', () => {
      if (resolved) {
        return;
      }
      res(Buffer.concat(bufferList));
    });
    incomingMessage.on('error', (err: any) => {
      rej(err);
    });
  });
}

export function getContentTypeByData(data: CanConvertToBuffer | Readable) {
  if (isPlainObject(data)) {
    return 'application/json;charset=UTF-8';
  } else {
    return 'text/plain';
  }
}
