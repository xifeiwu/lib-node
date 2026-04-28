import {Readable, Writable} from 'stream';
import {getBufferGenerator, largeDataToString} from '../../../transform';
import {isNumber, waitFor} from '../../../external';
import {logColorful} from '../../../log';
import {ReadFuncConfig, WriteFuncConfig} from './types';

export function getReadFunc(config?: ReadFuncConfig) {
  const {color, logPrefix = '', maxPrintSize = 16, delay, ...rest} = config ?? {};
  const generator = getBufferGenerator(rest);
  async function read(this: Readable) {
    try {
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
    } catch (err) {
      this.destroy(err as Error);
    }
  }
  return read;
}

export function getWritableFuncs(config?: WriteFuncConfig) {
  const {color, logPrefix = '', maxPrintSize = 16, delay} = config ?? {};
  async function write(this: Writable, chunk: Buffer, _enc, cb) {
    try {
      if (isNumber(delay) && delay > 0) {
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
    } catch (err) {
      cb ? cb(err as Error) : this.destroy(err as Error);
    }
  }
  async function final(this: Writable, cb) {
    if (color) {
      logColorful({color}, [logPrefix ? `[${logPrefix}]` : null, '[final]'].filter(Boolean).join(' '));
    }
    cb && cb();
  }
  return {write, final};
}
