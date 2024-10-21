import stream, {Transform, Readable} from 'stream';
import {isNumber} from '../external';
import {
  DataTypeFromBuffer,
  ReadableEvent,
  TargetDataTypeFromBuffer,
  fromBuffer,
  logColorful,
  toBuffer,
} from '../index';
import {getBufferMatcher} from '../general';
import {CanConvertToBuffer, WatchStreamOptions} from '../types';

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
 * @param {data}, null stands for end the reader immediately
 * TODO: use toBuffer
 */
export function toReadable(data: CanConvertToBuffer) {
  return new stream.Readable({
    read() {
      if (data !== null) {
        this.push(toBuffer(data));
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

export function watchReadableState(reader: Readable, options?: WatchStreamOptions) {
  const {colorStyle = {color: 'black'}, logPrefix = '', maxPrintSizeOnData} = options ?? {};
  /**
   * Event readable, data will change flowMode of Readable, so it will not in event list by default.
   * NOTICE: data, readable can not be listened together.
   */
  const eventNameList: ReadableEvent[] = ['pause', 'resume', 'end', 'error', 'close'];
  if (isNumber(maxPrintSizeOnData)) {
    reader.on('data', chunk => {
      const {byteLength} = chunk;
      logColorful(colorStyle, `${logPrefix} reader on-${'data'} [size: ${byteLength}]`);
      // console.log(chunk.toString());
      logColorful(
        colorStyle,
        byteLength > maxPrintSizeOnData
          ? chunk.subarray(0, maxPrintSizeOnData).toString() + '...'
          : chunk.toString()
      );
    });
  }
  for (const eventName of eventNameList) {
    reader.on(eventName, chunkOrError => {
      colorStyle && logColorful(colorStyle, `${logPrefix} reader on-${eventName}`);
      if (eventName === 'error') {
        colorStyle && logColorful(colorStyle, chunkOrError.stack);
      }
    });
  }
}
