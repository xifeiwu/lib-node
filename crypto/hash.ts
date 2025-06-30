import {BinaryToTextEncoding, createHash} from 'crypto';
import {isReadable, Readable} from 'stream';
import {toReadable} from '../stream';
import {CanConvertToBuffer} from '../types';
import {convertToBuffer} from '../transform';
import {getSubstring} from '../external';

type hashAlgorithm = 'sha1' | 'md5' | 'sha256';
interface GetHashOptions {
  algorithm: hashAlgorithm;
  encode?: BinaryToTextEncoding;
  maxDigestLength?: number;
}
const DEFAULT_ALGORITHM: GetHashOptions['algorithm'] = 'sha1';
const DEFAULT_ENCODE: GetHashOptions['encode'] = 'base64url';
/**
 * @deprecated by hashData
 */
export async function hashStream(data: Readable | CanConvertToBuffer, config: GetHashOptions) {
  const {algorithm = DEFAULT_ALGORITHM, encode = DEFAULT_ENCODE, maxDigestLength} = config;
  const hash = createHash(algorithm);
  const readable: Readable = toReadable(data);
  return new Promise<string>(res => {
    readable.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    readable.on('end', () => {
      const digest = hash.digest(encode);
      res(getSubstring(digest, maxDigestLength));
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
export function getHashDigest(
  data: CanConvertToBuffer,
  config?: {algorithm: hashAlgorithm; encode?: BinaryToTextEncoding; maxDigestLength?: number}
) {
  const {algorithm = DEFAULT_ALGORITHM, encode = DEFAULT_ENCODE, maxDigestLength} = config ?? {};
  const hash = createHash(algorithm);
  hash.update(convertToBuffer(data));
  const digest = hash.digest(encode);
  return getSubstring(digest, maxDigestLength);
}
