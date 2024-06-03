import readline from 'readline';
import {isFunction, isObject, isString} from './external';
import {LoggableContent, coloringContent, inspect, logWithColor} from './log';

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

/**
 * Go on or not?
 * Not by default
 */
export async function goOnOrNot(config?: {tips?: Array<LoggableContent>; defaultValue?: boolean}) {
  const {tips = [], defaultValue} = config ?? {};
  const interact = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const optionStr = [...tips, 'Go on or Not?[N/y/Y/yes]?']
    .map(it =>
      coloringContent(
        {
          color: 'yellow',
        },
        it
      )
    )
    .join('\n');
  return new Promise<boolean>(res => {
    interact.question(optionStr, answer => {
      if (answer === undefined && defaultValue !== undefined) {
        res(defaultValue);
      } else {
        if (['y', 'Y', 'yes'].includes(answer)) {
          res(true);
        } else {
          res(false);
        }
      }
      interact.close();
    });
  });
}
