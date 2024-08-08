import {BinaryToTextEncoding, createHash} from 'crypto';
import {Readable} from 'stream';

export async function hashStream(
  readable: Readable,
  config: {algorithm: 'sha1' | 'md5' | 'sha256'; encode?: BinaryToTextEncoding}
) {
  const {algorithm, encode = 'hex'} = config;
  const hash = createHash(algorithm);
  return new Promise<string>(res => {
    readable.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    readable.on('end', () => {
      res(hash.digest(encode));
    });
  });
}
