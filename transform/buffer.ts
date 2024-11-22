import {base64Chars, filesize, isNumber, isPlainObject, isString} from '../external';
import {BufferGeneratorConfig, CanConvertToBuffer} from '../types';

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
      return Buffer.concat(bufAll);
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
    buffer = Buffer.from(data as ArrayBuffer);
  }
  return buffer;
}

export function convertToBuffer(...args: Array<CanConvertToBuffer>) {
  const bufList: Buffer[] = [];
  for (const data of args) {
    let buffer: Buffer = data as Buffer;
    if (Array.isArray(data) && data.every(isNumber)) {
      buffer = Buffer.from(data as Array<number>);
    } else if (isPlainObject(data) || Array.isArray(data)) {
      buffer = Buffer.from(JSON.stringify(data));
    } else if (isString(data)) {
      buffer = Buffer.from(data as string);
    } else if (isNumber(data)) {
      buffer = Buffer.from([data as number]);
    } else if (ArrayBuffer.isView(data)) {
      buffer = Buffer.from(data as ArrayBuffer);
    }
    if (Buffer.isBuffer(buffer)) {
      bufList.push(buffer);
    }
  }
  return Buffer.concat(bufList);
}

export type TargetDataTypeFromBuffer = 'json' | 'string' | 'buffer';
export type DataTypeFromBuffer = string | number | object | Uint8Array; //Buffer | string | object | null;

export function fromBuffer(
  buffer: CanConvertToBuffer,
  dataType: TargetDataTypeFromBuffer
): DataTypeFromBuffer {
  if (!Buffer.isBuffer(buffer)) {
    buffer = toBuffer(buffer);
  }
  let finalData: DataTypeFromBuffer = buffer;
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

export function largeDataToString(
  data: CanConvertToBuffer,
  options?: {
    maxPrintSize?: number;
  }
) {
  const buf = toBuffer(data);
  const {maxPrintSize} = options ?? {};
  if (!isNumber(maxPrintSize)) {
    return buf.toString();
  }
  const remainingSize = buf.byteLength - maxPrintSize;
  let str = buf.subarray(0, maxPrintSize).toString();
  if (remainingSize > 0) {
    str += `...[${filesize(remainingSize)} remaining]`;
  }
  return str;
}

const G = Math.pow(1024, 3);
export function getBufferGenerator(config?: BufferGeneratorConfig) {
  const {source, sameItemPerGenerate = true, chunkSize = 1, count: maxGenerateCount = 3} = config ?? {};
  if (maxGenerateCount > 100000) {
    throw new Error(`value of countOfGenerate is too large`);
  }
  if (chunkSize > G) {
    throw new Error(`value of chunkSize is too large`);
  }
  let sourceBuffer = toBuffer(source ?? base64Chars);
  if (sourceBuffer.byteLength === 1) {
    // sameItemMode = true;
    const startCode = sourceBuffer[0];
    const items: number[] = [];
    let index = 0;
    while (index < maxGenerateCount) {
      items.push((startCode + index) % 255);
      index++;
    }
    sourceBuffer = Buffer.from(items);
  }
  const sourceBufferLength = sourceBuffer.byteLength;

  let indexOfSourceBuffer = 0;
  let generateCount = 0;
  function generator(): Buffer | null {
    let result: Buffer;
    if (generateCount >= maxGenerateCount) {
      return null;
    }
    if (sameItemPerGenerate) {
      result = Buffer.alloc(chunkSize).fill(sourceBuffer[generateCount % sourceBufferLength]);
    } else {
      indexOfSourceBuffer = indexOfSourceBuffer % sourceBufferLength;
      const sourceRemaining = sourceBuffer.subarray(indexOfSourceBuffer);
      if (sourceRemaining.byteLength > chunkSize) {
        result = sourceBuffer.subarray(indexOfSourceBuffer, indexOfSourceBuffer + chunkSize);
        indexOfSourceBuffer += chunkSize;
      } else {
        result = sourceRemaining;
        if (result.byteLength === chunkSize) {
          indexOfSourceBuffer = 0;
        }
        while (result.byteLength < chunkSize) {
          let diff = chunkSize - result.byteLength;
          while (diff >= sourceBufferLength) {
            result = Buffer.concat([result, sourceBuffer]);
            diff = chunkSize - result.byteLength;
          }
          if (diff > 0) {
            result = Buffer.concat([result, sourceBuffer.subarray(0, diff)]);
          }
          indexOfSourceBuffer = diff;
        }
      }
    }
    generateCount++;
    return result;
  }
  return generator;
}
