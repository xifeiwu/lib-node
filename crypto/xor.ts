import {BinaryLike, randomFillSync} from 'crypto';
import {Readable, Transform} from 'stream';
import {convertToBuffer} from '../transform';
import {CanConvertToBuffer} from '../types';

export const defaultIvBytes = 1;

export function getIv(length: number) {
  return randomFillSync(new Uint8Array(length));
}

export function xorData(data: BinaryLike, iv: CanConvertToBuffer) {
  const chunk = convertToBuffer(data);
  const key = convertToBuffer(iv);
  const keyLength = key.byteLength;
  const output = Buffer.alloc(chunk.byteLength);
  for (let i = 0; i < chunk.byteLength; i++) {
    output[i] = chunk[i] ^ iv[i % keyLength];
  }
  return output;
}

export function getXorDataFunc(iv: CanConvertToBuffer) {
  const ivBuf = convertToBuffer(iv);
  const ivLength = ivBuf.byteLength;
  let ivIndex = 0;
  function xorData(chunk: CanConvertToBuffer) {
    const buf = convertToBuffer(chunk);
    const output = Buffer.alloc(buf.byteLength);
    for (let i = 0; i < buf.byteLength; i++) {
      output[i] = chunk[i] ^ iv[ivIndex++ % ivLength];
    }
    return output;
  }
  return xorData;
}

export function getXorTransform(iv: BinaryLike, reader?: Readable) {
  const xorData = getXorDataFunc(iv);
  const transform = new Transform({
    transform(chunks, enc, cb) {
      (reader ?? this).push(xorData(chunks));
      cb && cb();
    },
  });
  return transform;
}
