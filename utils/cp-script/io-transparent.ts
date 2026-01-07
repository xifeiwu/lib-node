import stream from 'stream';
import {largeDataToString} from '../../transform';
import {coloringContent} from '../../log';

function trimCr(buf: Buffer) {
  while (buf[buf.byteLength - 1] === 0x0a) {
    buf = buf.subarray(0, buf.byteLength - 1);
  }
  return buf;
}

type Status = 'normal' | 'exiting';
let status: Status = 'normal';
/**
 * A scipt to test whether io connection between parent and child is through
 */
function start() {
  const counter = new stream.Transform({
    async transform(chunk, _enc, cb) {
      const str = trimCr(chunk).toString();
      if (status === 'exiting') {
        const statusCode = parseInt(str);
        process.exit(Number.isInteger(statusCode) ? statusCode : -1);
      } else if (str === 'exit') {
        status = 'exiting';
        process.stdout.write(coloringContent({color: 'red'}, 'Please set exit code in number format: '));
      } else {
        process.stdout.write('echo: ' + largeDataToString(chunk, {maxPrintSize: 32}));
      }
      cb && cb();
    },
  });

  process.stdin.pipe(counter);
}

start();
