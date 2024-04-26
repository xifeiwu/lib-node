import {isNumber, isPlainObject, isString} from '../external';

export type CanConvertToBuffer = string | number | object | Uint8Array;
export function toBuffer(data: CanConvertToBuffer | Array<CanConvertToBuffer>): Buffer {
  if (Array.isArray(data)) {
    if (data.every(isNumber)) {
      return Buffer.from(data as Array<number>);
    }
    const bufAll = data.map(toBuffer);
    return Buffer.concat(bufAll);
  }
  let buffer: Buffer = Buffer.alloc(0);
  if (isPlainObject(data)) {
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

export type TargetDataTypeFromBuffer = 'json' | 'string' | 'buffer';
export type DataTypeFromBuffer = Buffer | string | object | null;

export function fromBuffer(buffer: Buffer, dataType: TargetDataTypeFromBuffer): DataTypeFromBuffer {
  if (!dataType || dataType === 'buffer') {
    return buffer;
  }
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    return null;
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
