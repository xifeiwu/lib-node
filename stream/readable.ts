import stream, {Transform, Readable} from 'stream';
import {fromBuffer, convertToBuffer} from '../index';
import {CanConvertToBuffer, CanTransfromBetweenBuffer, ConvertBufferToType} from '../types';
import {getSequenceMatcher} from '../external';

export function getDataFromReadable(reader: Readable): Promise<Buffer> {
  const {readable} = reader;
  if (!readable) {
    return null;
  }
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
 * @param {data}, null stands for end the reader immediately
 * TODO: use toBuffer
 */
export function toReadable(data: CanConvertToBuffer | Readable) {
  if (data instanceof Readable) {
    return data;
  }
  return new stream.Readable({
    read() {
      if (data !== null) {
        this.push(convertToBuffer(data));
      }
      this.push(null);
    },
  });
}

const MAX_SIZE = 16 * 1024 * 1024;
export function getDataByTransform(
  cbOnData: (info: {chunkData?: Buffer; data?: CanTransfromBetweenBuffer; totalSize: number}) => void,
  config?: {
    targetType?: ConvertBufferToType;
    maxSize?: number;
  }
) {
  const {targetType, maxSize = MAX_SIZE} = config ?? {};
  let totalSize = 0;
  const bufferList: Buffer[] = [];
  return new Transform({
    transform(data, _enc, next) {
      this.push(data);
      totalSize += data.byteLength;
      if (totalSize < maxSize) {
        bufferList.push(data);
      }
      cbOnData({chunkData: data, totalSize});
      next && next();
    },
    final(cb) {
      cbOnData({data: fromBuffer(Buffer.concat(bufferList), targetType), totalSize});
      cb && cb();
    },
  });
}

export function getOneLineFromReader(
  reader: Readable,
  options?: {
    /** retrn first chunk when not find '\r\n' on first chunk  */
    firstChunkOnly?: boolean;
  }
): Promise<Buffer> {
  const {firstChunkOnly} = options ?? {};
  let resolve: (data: Buffer) => void;
  let reject: (err: Error) => void;
  const promise = new Promise<Buffer>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  let matcher = getSequenceMatcher('\r\n');
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
      if (firstChunkOnly) {
        resolve(Buffer.from(bytes));
      } else {
        if (reader.closed) {
          reject(new Error(`data end without suffix \r\n`));
        } else {
          /** If unresolve, wait for next chunk */
          reader.once('readable', parse);
        }
      }
    }
  };
  if (reader.readableLength > 0) {
    parse();
  } else {
    if (reader.readableFlowing === null) {
      reader.once('readable', parse);
    }
  }
  return promise;
}

const crlfMatcher = getSequenceMatcher('\r\n');
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
