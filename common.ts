import readline from 'readline';
import {isFunction, isObject, isString} from './fe';
import {inspect} from './log';

/**
 * Determine if a value is a Stream
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
export const isStream = val => isObject(val) && isFunction(val.pipe);

export async function selectOption<T extends {label: string}>(
  itemList: T[],
  option?: {
    tip?: Array<any> | string;
    defaultIndex?: number;
  }
): Promise<T> {
  const {tip = 'please select', defaultIndex = 0} = option ? option : {};
  let tipArr: string[] = [];
  if (isString(tip)) {
    // tip = [tip];
    tipArr.push(tip as string);
  } else {
    tipArr = (tip as Array<any>).map(it => inspect(it));
  }
  tipArr.push(`[default index is ${defaultIndex})]:`);
  const optionStr = itemList
    .map((it, index) => {
      return `${index}. ${String(it.label ? it.label : it)}`;
    })
    .concat(...tipArr)
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
      if (!itemList[index]) {
        rej(`index ${index} does not existed in options`);
      } else {
        res(itemList[index]);
      }
      interact.close();
    });
  });
}
