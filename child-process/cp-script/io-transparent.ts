import stream from 'stream';
import {largeDataToString} from '../../transform';

function start() {
  /**
   * A scipt to test io between parent and child is through
   */
  const counter = new stream.Transform({
    transform(chunk, _enc, cb) {
      process.stdout.write('remote: ' + largeDataToString(chunk, {maxPrintSize: 32}));
      cb && cb();
    },
  });

  process.stdin.pipe(counter);
}

start();
