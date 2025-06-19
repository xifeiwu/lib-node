import {Readable} from 'stream';
import {getBufferGenerator, largeDataToString} from '../../transform';
import {isNumber, waitFor} from '../../external';
import {logColorful} from '../../log';
import {CustomizedReadableConfig, DataGeneratorConfig} from './types';

function getPushFunc(config?: DataGeneratorConfig) {
  const {color, maxPrintSize = 16, delay, ...rest} = config ?? {};
  const generator = getBufferGenerator(rest);
  async function push(this: Readable) {
    if (isNumber(delay) && delay > 0) {
      await waitFor(delay);
    }
    if (!this.readable) {
      return;
    }
    const data = generator();
    if (data !== null) {
      if (color) {
        // onDataPrintState(data, {color, prefix: 'push'});
        logColorful({color}, ['push', largeDataToString(data, {maxPrintSize})].join(' '));
      }
      this.push(data);
    } else {
      this.push(null);
    }
  }
  return push;
}

/**
 * configurable reader
 */
export function getCustomizableReader(config?: CustomizedReadableConfig) {
  const {readableOptions = {}, ...restConfig} = config ?? {};
  const d1 = new Readable({
    read: getPushFunc(restConfig),
    ...readableOptions,
  });
  return d1;
}
