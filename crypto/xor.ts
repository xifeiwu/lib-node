import {BinaryLike, randomFillSync} from 'crypto';
import {Transform} from 'stream';
import {toBuffer} from '../transform';
import {CanConvertToBuffer} from '../types';

export const defaultIvBytes = 1;

export function getIv(length: number) {
  return randomFillSync(new Uint8Array(length));
}
export function xorData(data: BinaryLike, iv: CanConvertToBuffer) {
  const chunk = toBuffer(data);
  const key = toBuffer(iv);
  const keyLength = key.byteLength;
  const output = Buffer.alloc(chunk.byteLength);
  for (let i = 0; i < chunk.byteLength; i++) {
    output[i] = chunk[i] ^ iv[i % keyLength];
  }
  return output;
}
export function getXorTransform(iv: BinaryLike) {
  const transform = new Transform({
    transform(chunks, enc, cb) {
      this.push(xorData(chunks, iv));
      cb && cb();
    },
  });
  return transform;
}
