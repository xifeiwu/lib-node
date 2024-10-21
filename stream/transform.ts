import {Duplex, Transform} from 'stream';
import {waitFor} from '../external';
import {WatchStreamOptions} from '../types';
import {watchReadableState} from './readable';
import {watchWritableState} from './writable';

// TODO: fix stream.push() after EOF
export function slowStream(chunkSize = 1024, wait = 500) {
  return new Transform({
    async transform(data, enc, next) {
      const dataSize = data.length;
      let pos = 0;
      let chunk = null;
      while (pos < dataSize) {
        let size = chunkSize;
        if (pos + chunkSize > dataSize) {
          size = dataSize - pos;
        }
        chunk = Buffer.alloc(size);
        data.copy(chunk, 0, pos, pos + size);
        await waitFor(wait);
        this.push(chunk);
        pos += size;
      }
      next();
    },
  });
}

export function watchDuplexState(duplex: Duplex, options?: WatchStreamOptions) {
  watchReadableState(duplex, options);
  watchWritableState(duplex, options);
}
