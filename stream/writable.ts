import {Writable} from 'stream';
import {toBuffer} from '../transform';

/**
 * Get writer with data write to a buffer
 * @returns
 */
export function getCacheWriter() {
  const bufferList: Buffer[] = [];
  const writer = new Writable({
    write(chunk, _enc, cb) {
      bufferList.push(toBuffer(chunk));
      cb && cb();
    },
    final(cb) {
      cb && cb();
    },
  });
  const waitCacheData = new Promise<Buffer>((res, rej) => {
    writer.on('finish', () => {
      res(Buffer.concat(bufferList));
    });
    writer.on('error', err => {
      rej(err);
    });
  });
  return {writer, waitCacheData};
}
