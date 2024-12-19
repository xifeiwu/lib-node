import {BinaryToTextEncoding, createHash} from 'crypto';
import {isReadable, Readable} from 'stream';
import {toReadable} from '../stream';
import {CanConvertToBuffer} from '../types';
import {convertToBuffer} from '../transform';

type hashAlgorithm = 'sha1' | 'md5' | 'sha256';

/**
 * @deprecated by hashData
 */
export async function hashStream(
  data: Readable | CanConvertToBuffer,
  config: {algorithm: hashAlgorithm; encode?: BinaryToTextEncoding}
) {
  const {algorithm, encode = 'hex'} = config;
  const hash = createHash(algorithm);
  const readable: Readable = toReadable(data);
  return new Promise<string>(res => {
    readable.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    readable.on('end', () => {
      res(hash.digest(encode));
    });
  });
}

/**
 * Get hash digest in async way
 */
export async function hashData(
  data: CanConvertToBuffer | Readable,
  config: {algorithm: hashAlgorithm; encode?: BinaryToTextEncoding}
) {
  return await hashStream(data, config);
}

/**
 * Get hash digest in sync way
 */
export function getHash(
  data: CanConvertToBuffer,
  config: {algorithm: hashAlgorithm; encode?: BinaryToTextEncoding}
) {
  const {algorithm, encode = 'hex'} = config;
  const hash = createHash(algorithm);
  hash.update(convertToBuffer(data));
  return hash.digest(encode);
}
