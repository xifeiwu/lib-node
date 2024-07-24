import {BinaryLike, createCipheriv, createDecipheriv, randomFillSync, scryptSync} from 'crypto';

const algorithm = 'aes-192-cbc';
const password = 'Password used to generate key';
const salt = 'the-salt';

// const iv = randomFillSync(new Uint8Array(16));
export const ivLength = 16;

const key = scryptSync(password, salt, 24);

export function getIv(ivLength: number) {
  return randomFillSync(new Uint8Array(ivLength));
}
export function getCipher(iv?: BinaryLike) {
  if (!iv) {
    iv = getIv(ivLength);
  }
  const cipher = createCipheriv(algorithm, key, iv);
  return {cipher, iv};
}

export function getDcipher(iv: BinaryLike) {
  const dcipher = createDecipheriv(algorithm, key, iv);
  return dcipher;
}

export function encrypt(data: Buffer, iv?: BinaryLike) {
  const {cipher} = getCipher(iv);
  const p1 = cipher.update(data);
  const p2 = cipher.final();
  return {data: Buffer.concat([p1, p2]), iv};
}
export function decript(data: Buffer, iv: BinaryLike) {
  const dcipher = getDcipher(iv);
  const p1 = dcipher.update(data);
  const p2 = dcipher.final();
  return Buffer.concat([p1, p2]);
}
