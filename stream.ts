import * as stream from 'stream';
import {isString, isObject, waitMilliSeconds} from './common';

export function getStreamData(req: stream.Stream) {
  return new Promise((resolve, reject) => {
    const bufferList: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      // console.log(chunk);
      // result += chunk;
      bufferList.push(chunk);
    });
    req.on('end', function () {
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
      var pos = 0;
      var chunk = null;
      while (pos < dataSize) {
        var size = chunkSize;
        if (pos + chunkSize > dataSize) {
          size = dataSize - pos;
        }
        chunk = Buffer.alloc(size);
        data.copy(chunk, 0, pos, pos + size);
        await waitMilliSeconds(wait);
        this.push(chunk);
        pos += size;
      }
      next();
    },
  });
}
