import {BinaryToTextEncoding, createHash} from 'crypto';
import {isReadable, Readable} from 'stream';
import {toReadable} from '../stream';
import {CanConvertToBuffer} from '../types';
import {convertToBuffer} from '../transform';

type hashAlgorithm = 'sha1' | 'md5' | 'sha256';

export async function hashStream(
  data: Readable | CanConvertToBuffer,
  config: {algorithm: hashAlgorithm; encode?: BinaryToTextEncoding}
) {
  const {algorithm, encode = 'hex'} = config;
  const hash = createHash(algorithm);
  const readable: Readable = isReadable(data as Readable) ? (data as Readable) : toReadable(data);
  return new Promise<string>(res => {
    readable.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    readable.on('end', () => {
      res(hash.digest(encode));
    });
  });
}

export function getHashDigest(
  data: CanConvertToBuffer,
  config: {algorithm: hashAlgorithm; encode?: BinaryToTextEncoding}
) {
  const {algorithm, encode = 'hex'} = config;
  const hash = createHash(algorithm);
  hash.update(convertToBuffer(data));
  return hash.digest(encode);
}
