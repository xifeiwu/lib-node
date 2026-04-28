import {Readable, Writable} from 'stream';
import {getBufferGenerator, largeDataToString} from '../../../../transform';
import {isNumber, waitFor} from '../../../../external';
import {logColorful} from '../../../../log';
import {ReadFuncConfig, WriteFuncConfig} from './types';

export function getReadFunc(config?: ReadFuncConfig) {
  const {color, logPrefix = '', maxPrintSize = 16, delay, ...rest} = config ?? {};
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
        logColorful(
          {color},
          [logPrefix ? `[${logPrefix}]` : null, '[push]', largeDataToString(data, {maxPrintSize})]
            .filter(Boolean)
            .join(' ')
        );
      }
      this.push(data);
    } else {
      this.push(null);
    }
  }
  return read;
}

export function getWritableFuncs(config?: WriteFuncConfig) {
  const {color, logPrefix = '', maxPrintSize = 16, delay} = config ?? {};
  async function write(this: Writable, chunk: Buffer, _enc, cb) {
    /** for delay */
    if (isNumber(delay)) {
      await waitFor(delay);
    }
    if (color) {
      logColorful(
        {color},
        [logPrefix ? `[${logPrefix}]` : null, '[write]', largeDataToString(chunk, {maxPrintSize})]
          .filter(Boolean)
          .join(' ')
      );
    }
    cb && cb();
  }
  async function final(this: Writable, cb) {
    if (color) {
      logColorful({color}, [logPrefix ? `[${logPrefix}]` : null, '[final]'].filter(Boolean).join(' '));
    }
    cb && cb();
  }
  return {write, final};
}
