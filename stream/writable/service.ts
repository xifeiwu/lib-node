import {Writable} from 'stream';
import {toBuffer} from '../../transform';
import {WatchStreamOptions} from '../../types';
import {logColorful} from '../../log';

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

export function printWritableState(writer: Writable) {
  const {closed, destroyed, writable, writableCorked, writableEnded, writableLength} = writer;
  logColorful({}, {closed, destroyed, writable, writableCorked, writableEnded, writableLength});
}

export function watchWritableState(writer: Writable, options?: WatchStreamOptions) {
  const {colorStyle = {color: 'black'}, logPrefix = '', printState} = options ?? {};
  if (printState) {
    logColorful(colorStyle, `${logPrefix}writer state:`);
    printWritableState(writer);
  }
  const eventNameList = ['drain', 'finish', 'pipe', 'unpipe', 'error', 'close'];
  for (const eventName of eventNameList) {
    writer.on(eventName, chunkOrError => {
      logColorful(colorStyle, `${logPrefix}writer on-${eventName}`);
      if (eventName === 'error') {
        colorStyle && logColorful(colorStyle, chunkOrError.stack);
      }
      printState && printWritableState(writer);
    });
  }
}
