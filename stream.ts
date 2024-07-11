import stream, {Transform, Readable, Writable} from 'stream';
import {isString, isObject, waitFor} from './external';
import {DataTypeFromBuffer, TargetDataTypeFromBuffer, fromBuffer, toBuffer} from './transform';
import {getBufferMatcher} from './common';

export function getDataFromReadable(reader: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bufferList: Buffer[] = [];
    reader.on('data', (chunk: Buffer) => {
      // console.log(`chunk`);
      // console.log(chunk);
      // result += chunk;
      bufferList.push(chunk);
    });
    reader.on('end', () => {
      resolve(Buffer.concat(bufferList));
    });
    reader.on('error', (err: any) => {
      reject(err);
    });
  });
}

/**
 * Get writer with data write to a buffer
 * @returns
 */
export function getCacheWriter() {
  const bufferList: Buffer[] = [];
  const writer = new Writable({
    write(chunk, _enc, cb) {
      bufferList.push(toBuffer(chunk));
      cb && cb();
    },
    final(cb) {
      cb && cb();
    },
  });
  const waitCacheData = new Promise<Buffer>((res, rej) => {
    writer.on('finish', () => {
      res(Buffer.concat(bufferList));
    });
    writer.on('error', err => {
      rej(err);
    });
  });
  return {writer, waitCacheData};
}
/**
 * @param {data}, null stands for end the reader immediately
 * TODO: use toBuffer
 */
export function toReadable(data: Buffer | string | object | null) {
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
      if (data !== null) {
        this.push(data);
      }
      this.push(null);
    },
  });
}

const MAX_SIZE = 16 * 1024 * 1024;
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

export function getOneLineFromReader(reader: Readable) {
  let resolve: (data: Buffer) => void;
  let reject: (err: Error) => void;
  const promise = new Promise<Buffer>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let matcher = getBufferMatcher('\r\n');
  let resolved = false;
  const bytes: number[] = [];
  const parse = () => {
    if (resolved) {
      return;
    }
    if (reader.closed) {
      return;
    }
    let data: Buffer;
    while ((data = reader.read(1))) {
      const [oneByte] = data;
      /** TODO: Which way is more cheap? */
      // cacheBuffer = Buffer.concat([cacheBuffer, oneByte]);
      bytes.push(oneByte);
      if (matcher(oneByte)) {
        resolve(Buffer.from(bytes));
        resolved = true;
        break;
      }
    }
    if (!resolved) {
      if (reader.closed) {
        reject(new Error(`data end without suffix \r\n`));
      } else {
        /** If unresolve, wait for next chunk */
        reader.once('readable', parse);
      }
    }
  };
  if (reader.readableLength > 0) {
    parse();
  } else {
    reader.once('readable', parse);
  }
  return promise;
}

const crlfMatcher = getBufferMatcher('\r\n');
export function getOneLineFromBuffer(buffer: Buffer) {
  // let matcher = getBufferMatcher('\r\n');
  let success = false;
  const consumed: number[] = [];
  while (buffer.byteLength > 0) {
    const [firstByte] = buffer;
    consumed.push(firstByte);
    buffer = buffer.subarray(1);
    if (crlfMatcher(firstByte)) {
      success = true;
      break;
    }
  }
  return {
    consumed: Buffer.from(consumed),
    remaining: buffer,
    success,
  };
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
