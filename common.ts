import readline from 'readline';
import {isFunction, isObject} from './fe';

/**
 * Determine if a value is a Stream
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
export const isStream = val => isObject(val) && isFunction(val.pipe);

export function selectOption<T extends {label: string}>(
  options: T[],
  option?: {
    tip?: string;
    defaultIndex?: number;
  }
): Promise<T> {
  const {tip = 'please select', defaultIndex = 0} = option ? option : {};
  const optionStr = options
    .map((it, index) => {
      return `${index}. ${String(it.label ? it.label : it)}`;
    })
    .concat(`${tip}(default index is ${defaultIndex}): `)
    .join('\n');
  const interact = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((res, rej) => {
    interact.question(optionStr, answer => {
      let index = parseInt(answer);
      if (Number.isNaN(index)) {
        index = defaultIndex;
      }
      if (!options[index]) {
        rej(`index ${index} does not existed in options`);
      } else {
        res(options[index]);
      }
      interact.close();
    });
  });
}
