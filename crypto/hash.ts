import {BinaryLike, BinaryToTextEncoding, createHash, createHmac, Hash, Hmac, KeyObject} from 'crypto';
import {Readable} from 'stream';
import {toReadable} from '../stream';
import {CanConvertToBuffer} from '../types';
import {convertToBuffer} from '../transform';
import {getSubstring} from '../external';

type digestAlgorithm = 'sha1' | 'md5' | 'sha256';
interface GetDigestOptions {
  algorithm: digestAlgorithm;
  encode?: BinaryToTextEncoding;
  maxDigestLength?: number;
}
const DEFAULT_ALGORITHM: GetDigestOptions['algorithm'] = 'sha1';
const DEFAULT_ENCODE: GetDigestOptions['encode'] = 'base64url';

function sliceDigestResult(digest: string | Buffer, maxDigestLength?: number): string | Buffer {
  if (maxDigestLength) {
    return digest.slice(0, maxDigestLength);
  }
  return digest;
}
// function toStrDigest(value: string | Buffer): string {
//   if (Buffer.isBuffer(value)) {
//     return value.toString('hex');
//   }
//   return value;
// }

function getDigest(
  inst: Hash | Hmac,
  data: CanConvertToBuffer,
  options?: Omit<GetDigestOptions, 'algorithm'>
) {
  const {encode = DEFAULT_ENCODE, maxDigestLength} = options ?? {};
  inst.update(convertToBuffer(data));
  const result = inst.digest(encode);
  return sliceDigestResult(result, maxDigestLength);
}

function getDigestFromReadable(
  inst: Hash | Hmac,
  data: Readable | CanConvertToBuffer,
  options?: Omit<GetDigestOptions, 'algorithm'>
) {
  const {encode = DEFAULT_ENCODE, maxDigestLength} = options ?? {};
  const readable: Readable = toReadable(data);
  return new Promise<string>(res => {
    readable.on('data', (chunk: Buffer) => {
      inst.update(chunk);
    });
    readable.on('end', () => {
      const digest = inst.digest(encode);
      res(sliceDigestResult(digest, maxDigestLength) as string);
    });
  });
}
/**
 * @deprecated by hashData
 */
export async function hashStream(data: Readable | CanConvertToBuffer, config: GetDigestOptions) {
  const {algorithm = DEFAULT_ALGORITHM, ...restOptions} = config;
  const hash = createHash(algorithm);
  return getDigestFromReadable(hash, data, restOptions);
}

/**
 * Get hash digest in async way
 */
export async function hashData(
  data: CanConvertToBuffer | Readable,
  config: {algorithm: digestAlgorithm; encode?: BinaryToTextEncoding}
) {
  return await hashStream(data, config);
}

/**
 * Get hash digest in sync way
 */
export function getHashDigest(data: CanConvertToBuffer, config?: GetDigestOptions) {
  const {algorithm = DEFAULT_ALGORITHM, ...restOptions} = config ?? {};
  const hash = createHash(algorithm);
  return getDigest(hash, data, restOptions);
}

interface GetHmacOptions extends GetDigestOptions {
  key: BinaryLike | KeyObject;
}
export function getHmacDigest(data: CanConvertToBuffer, config?: GetHmacOptions) {
  const {algorithm = DEFAULT_ALGORITHM, key, ...restOptions} = config ?? {};
  const inst = createHmac(algorithm, key);
  return getDigest(inst, data, restOptions);
}
