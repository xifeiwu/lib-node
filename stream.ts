import stream, {Readable} from 'stream';
import {isString, isObject, waitFor, isPlainObject} from './fe';
import {isStream} from './common';

export function getStreamData(req: stream.Stream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bufferList: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      // console.log(chunk);
      // result += chunk;
      bufferList.push(chunk);
    });
    req.on('end', function() {
      resolve(Buffer.concat(bufferList));
    });
    req.on('error', (err: any) => {
      reject(err);
    });
  });
}

/**
 * @param {data}, String or Object
 */
export function toStream(data: Buffer | string | object) {
  if (Buffer.isBuffer(data)) {
    data = data.toString();
  }
  if (isObject(data)) {
    data = JSON.stringify(data);
  }
  if (!isString(data)) {
    console.log(`warning: data should be string or buffer`);
  }
  return new stream.Readable({
    read() {
      this.push(data);
      this.push(null);
    },
  });
}

// TODO: fix stream.push() after EOF
export function slowStream(chunkSize = 1024, wait = 500) {
  return new stream.Transform({
    async transform(data, enc, next) {
      const dataSize = data.length;
      let pos = 0;
      let chunk = null;
      while (pos < dataSize) {
        let size = chunkSize;
        if (pos + chunkSize > dataSize) {
          size = dataSize - pos;
        }
        chunk = Buffer.alloc(size);
        data.copy(chunk, 0, pos, pos + size);
        await waitFor(wait);
        this.push(chunk);
        pos += size;
      }
      next();
    },
  });
}

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
