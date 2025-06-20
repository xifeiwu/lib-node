import {Readable, Writable} from 'stream';
import {getBufferGenerator, largeDataToString} from '../../../../transform';
import {isNumber, waitFor} from '../../../../external';
import {logColorful} from '../../../../log';
import {ReadFuncConfig, WriteFuncConfig} from './types';

export function getReadFunc(config?: ReadFuncConfig) {
  const {color, maxPrintSize = 16, delay, ...rest} = config ?? {};
  const generator = getBufferGenerator(rest);
  async function read(this: Readable) {
    if (isNumber(delay) && delay > 0) {
      await waitFor(delay);
    }
    if (!this.readable) {
      return;
    }
    const data = generator();
    if (data !== null) {
      if (color) {
        logColorful({color}, ['push', largeDataToString(data, {maxPrintSize})].join(' '));
      }
      this.push(data);
    } else {
      this.push(null);
    }
  }
  return read;
}

export function getWriteFunc(config?: WriteFuncConfig) {
  const {color, maxPrintSize = 16, delay} = config ?? {};
  async function write(this: Writable, chunk: Buffer, _enc, cb) {
    /** for delay */
    if (isNumber(delay)) {
      await waitFor(delay);
    }
    if (color) {
      logColorful({color}, ['write', largeDataToString(chunk, {maxPrintSize})].join(' '));
    }
    cb && cb();
  }
  return write;
}
