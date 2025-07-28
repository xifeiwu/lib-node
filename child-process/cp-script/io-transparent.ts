import stream from 'stream';
import {largeDataToString} from '../../transform';

/**
 * A scipt to test whether io connection between parent and child is through
 */
function start() {
  const counter = new stream.Transform({
    transform(chunk, _enc, cb) {
      process.stdout.write('remote: ' + largeDataToString(chunk, {maxPrintSize: 32}));
      cb && cb();
    },
  });

  process.stdin.pipe(counter);
}

start();
