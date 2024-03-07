import stream, {Readable, Transform} from 'stream';
import {isString, isObject, waitFor, isPlainObject} from './fe';
import {DataTypeFromBuffer, TargetDataTypeFromBuffer, fromBuffer} from './transform';

export function getStreamData(req: stream.Stream): Promise<Buffer> {
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

const MAX_SIZE = 32 * 1024 * 1024;
export function getDataByTransform(
  cb2Data: (data: DataTypeFromBuffer) => void,
  config?: {
    targetType?: TargetDataTypeFromBuffer;
    maxSize?: number;
  }
) {
  const {targetType, maxSize = MAX_SIZE} = config ?? {};
  let totalSize = 0;
  const bufferList: Buffer[] = [];
  return new Transform({
    transform(data, _enc, next) {
      this.push(data);
      if (totalSize < maxSize) {
        bufferList.push(data);
        totalSize += data.byteLength;
      }
      next && next();
    },
    final(cb) {
      cb2Data(fromBuffer(Buffer.concat(bufferList), targetType));
      cb && cb();
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
