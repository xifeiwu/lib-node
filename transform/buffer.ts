import {BASE64_CHARS, byteToWord, isNumber, isPlainObject, isString, LETTERS, NUMBERS} from '../external';
import {
  BufferGeneratorConfig,
  CanConvertToBuffer,
  CanTransfromBetweenBuffer,
  ConvertBufferToType,
} from '../types';

/**
 * @deprecated by convertToBuffer as array params is confusing
 * Should take care of number: toBuffer(1) is totally different from toBuffer('1')
 */
export function toBuffer(data: CanConvertToBuffer | Array<CanConvertToBuffer>, level = 0): Buffer {
  if (Array.isArray(data) && level === 0) {
    if (data.every(isNumber)) {
      return Buffer.from(data as Array<number>);
    } else {
      const bufAll = data
        .map(it => {
          return toBuffer(it, level + 1);
        })
        .filter(Buffer.isBuffer);
      return Buffer.concat(bufAll.map(it => new Uint8Array(it)));
    }
  }
  let buffer: Buffer = Buffer.alloc(0);
  if (isPlainObject(data) || Array.isArray(data)) {
    buffer = Buffer.from(JSON.stringify(data));
  } else if (isString(data)) {
    buffer = Buffer.from(data as string);
  } else if (isNumber(data)) {
    buffer = Buffer.from([data as number]);
  } else if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (ArrayBuffer.isView(data)) {
    buffer = Buffer.from(data as Uint8Array);
  }
  return buffer;
}

export function convertToBuffer(...args: Array<CanConvertToBuffer>): Buffer<ArrayBuffer> {
  const bufList: Buffer[] = [];
  for (const data of args) {
    let buffer: Buffer = data as Buffer;
    if (Array.isArray(data)) {
      if (data.length === 0) {
        // when array length is 0, data.every(isNumber) is true
        buffer = Buffer.from(JSON.stringify(data));
      } else {
        if (data.every(isNumber)) {
          buffer = Buffer.from(data as Array<number>);
        } else {
          buffer = Buffer.from(JSON.stringify(data));
        }
      }
    } else if (isPlainObject(data)) {
      buffer = Buffer.from(JSON.stringify(data));
    } else if (isString(data)) {
      buffer = Buffer.from(data as string);
    } else if (isNumber(data)) {
      buffer = Buffer.from([data as number]);
    } else if (ArrayBuffer.isView(data)) {
      buffer = Buffer.from(data as Uint8Array);
    }
    if (Buffer.isBuffer(buffer)) {
      bufList.push(buffer);
    }
  }
  /** return undefined when nothing is passed or transfered */
  if (bufList.length === 0) {
    return undefined;
  } else if (bufList.length === 1) {
    /** concat will allocate new space */
    return bufList[0] as Buffer<ArrayBuffer>;
  } else {
    return Buffer.concat(bufList.map(it => new Uint8Array(it)));
  }
}

export function fromBuffer(
  buffer: CanConvertToBuffer,
  dataType: ConvertBufferToType
): CanTransfromBetweenBuffer {
  if (!Buffer.isBuffer(buffer)) {
    buffer = convertToBuffer(buffer);
  }
  let finalData: CanTransfromBetweenBuffer = buffer;
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

/**
 * Only console part data if it's too large
 */
export function largeDataToString(
  data: CanConvertToBuffer,
  options?: {
    maxPrintSize?: number;
  }
) {
  const buf = convertToBuffer(data);
  const {maxPrintSize} = options ?? {};
  if (!isNumber(maxPrintSize)) {
    return buf.toString();
  }
  const remainingSize = buf.byteLength - maxPrintSize;
  let str = buf.subarray(0, maxPrintSize).toString();
  if (remainingSize > 0) {
    str += `...[${byteToWord(remainingSize)} remaining]`;
  }
  return str;
}

const G = Math.pow(1024, 3);
export function getBufferGenerator(config?: BufferGeneratorConfig) {
  const {source, sameItemPerGenerate = true, chunkSize = 1, generateCount = 3} = config ?? {};
  if (generateCount > 10000) {
    throw new Error(`value of countOfGenerate is too large`);
  }
  let sourceBuffer = convertToBuffer(
    source === 'word' ? LETTERS : source === 'number' ? NUMBERS : BASE64_CHARS
  );
  /**
   * Try to get more different char when the length is 1
   */
  if (sourceBuffer.byteLength === 1) {
    const startCode = sourceBuffer[0];
    const items: number[] = [];
    let index = 0;
    while (index < generateCount) {
      items.push((startCode + index) % 255);
      index++;
    }
    sourceBuffer = Buffer.from(items);
  }
  const sourceBufferLength = sourceBuffer.byteLength;

  let indexOfSourceBuffer = 0;
  let count = 0;
  /**
   * return a chunk of buffer per call, and return null when count reach maxGenerateCount.
   */
  function generator(): Buffer | null {
    let result: Buffer;
    if (count >= generateCount) {
      return null;
    }
    if (sameItemPerGenerate) {
      result = Buffer.alloc(chunkSize).fill(sourceBuffer[count % sourceBufferLength]);
    } else {
      indexOfSourceBuffer = indexOfSourceBuffer % sourceBufferLength;
      const remainingLength = sourceBufferLength - indexOfSourceBuffer;
      if (remainingLength >= chunkSize) {
        result = sourceBuffer.subarray(indexOfSourceBuffer, indexOfSourceBuffer + chunkSize);
        indexOfSourceBuffer += chunkSize;
      } else {
        result = sourceBuffer.subarray(indexOfSourceBuffer);
        while (result.byteLength < chunkSize) {
          let diff = chunkSize - result.byteLength;
          if (diff <= sourceBufferLength) {
            result = Buffer.concat([result, sourceBuffer.subarray(0, diff)].map(it => new Uint8Array(it)));
            indexOfSourceBuffer = diff;
            break;
          } else {
            result = Buffer.concat([result, sourceBuffer].map(it => new Uint8Array(it)));
          }
        }
      }
    }
    count++;
    return result;
  }
  return generator;
}
