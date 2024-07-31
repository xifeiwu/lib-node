import {BinaryLike, randomFillSync} from 'crypto';
import {Transform} from 'stream';

export const defaultIvBytes = 1;

export function getIv(ivLength: number) {
  return randomFillSync(new Uint8Array(ivLength));
}
export function getCipher(iv?: BinaryLike) {
  if (!iv) {
    iv = getIv(defaultIvBytes);
  }
  const cipher = new Transform({
    transform(chunks, enc, cb) {
      console.log(`cipher chunk.toString()`)
      console.log(chunks.toString())
      const output = Buffer.alloc(chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        output[i] = chunks[i] ^ iv[0];
      }
      this.push(output);
      cb && cb();
    },
  });
  return {cipher, iv};
}

export function getDcipher(iv: BinaryLike) {
  const dcipher = new Transform({
    transform(chunks, enc, cb) {
      console.log(`dcipher chunk.toString()`)
      console.log(chunks.toString())
      const output = Buffer.alloc(chunks.length);
      for (let i = 0; i < chunks.length; i++) {
        output[i] = chunks[i] ^ iv[0];
      }
      this.push(output);
      cb && cb();
    },
  });
  return dcipher;
}

export function encrypt(data: Buffer, iv?: BinaryLike) {
  if (!iv) {
    iv = getIv(defaultIvBytes);
  }
  const output = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    output[i] = data[i] ^ iv[0];
  }
  return {data: output, iv};
  // const {cipher} = getCipher(iv);
}
export function decript(chunks: Buffer, iv: BinaryLike) {
  const output = Buffer.alloc(chunks.length);
  for (let i = 0; i < chunks.length; i++) {
    output[i] = chunks[i] ^ iv[0];
  }
  return output;
}
