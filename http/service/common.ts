import {isPlainObject} from '../../external';
import {Readable} from 'stream';
import {ReadableWithMeta, CanConvertToBuffer} from '../../types';

export async function getIncomingMessageData(incomingMessage: ReadableWithMeta) {
  const {headers} = incomingMessage;
  const contentLength = parseInt(headers['content-length']);
  let resolved = false;
  return new Promise<Buffer | undefined>((res, rej) => {
    let byteLength = 0;
    const bufferList: Buffer[] = [];
    incomingMessage.on('data', (chunk: Buffer) => {
      if (resolved) {
        return;
      }
      bufferList.push(chunk);
      byteLength += chunk.byteLength;
      /** This logic is a bit redundant, nodejs http module can handle it well and trigger end event at correct moment */
      if (!Number.isNaN(contentLength) && byteLength >= contentLength) {
        resolved = true;
        res(Buffer.concat(bufferList).subarray(0, contentLength));
      }
    });
    incomingMessage.on('end', () => {
      if (resolved) {
        return;
      }
      if (bufferList.length > 0) {
        res(Buffer.concat(bufferList));
      } else {
        res(undefined);
      }
    });
    incomingMessage.on('error', (err: any) => {
      rej(err);
    });
  });
}

export function getContentTypeByData(data: CanConvertToBuffer | Readable) {
  if (isPlainObject(data) || Array.isArray(data)) {
    return 'application/json;charset=UTF-8';
  } else {
    return 'text/plain';
  }
}

export function parseContentType(contentType?: string) {
  if (!contentType) {
    return {};
  }
  const [type, ...rest] = contentType.split(/; ?/).map(it => it.trim());
  // charset, boundary
  const props = rest.reduce<object>((sum, str) => {
    const index = str.indexOf('=');
    if (index > 0) {
      const key = str.substring(0, index);
      const value = str.substring(index + 1);
      return {
        ...sum,
        [key]: value,
      };
    } else {
      return sum;
    }
  }, {});
  // return [type];
  return {
    type,
    props,
  };
}
