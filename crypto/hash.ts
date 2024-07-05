import {BinaryToTextEncoding, Hash} from 'crypto';
import {Readable} from 'stream';
export async function hashStream(hash: Hash, readable: Readable, encode: BinaryToTextEncoding = 'hex') {
  return new Promise<string>(res => {
    readable.on('data', (chunk: Buffer) => {
      hash.update(chunk);
    });
    readable.on('end', () => {
      res(hash.digest(encode));
    });
  });
}
