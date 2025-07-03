import readline from 'readline';
import {isFunction, isNumber, isObject, isString} from './external';
import {coloringContent, inspect} from './log';
import {CanConvertToBuffer, ColorStyle, LoggableContent} from './types';
import {toBuffer} from './transform';

/**
 * Determine if a value is a Stream
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
export const isStream = val => isObject(val) && isFunction(val.pipe);

/**
 * Get selected item by index or its label content
 */
export async function selectOption<T extends {label: string}>(
  itemList: T[],
  option?: {
    tip?: Array<any> | string;
    defaultIndex?: number;
  }
): Promise<T & {answer: number | string}> {
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
      /** 1. Try answer as option index */
      const answerAsIndex = parseInt(answer);
      const answerIsNumber = Number.isInteger(answerAsIndex);
      let index: number;
      if (answerIsNumber) {
        index = answerAsIndex;
      } else {
        /** 2. If fail, try answer as option label, and find index by option label */
        const i = itemList.findIndex(it => it.label === answer);
        if (i !== -1) {
          index = i;
        } else {
          /** 3. Use defaultIndex as index value */
          index = defaultIndex;
        }
      }
      if (!itemList[index]) {
        rej(`index ${index} does not existed in options`);
      } else {
        res({...itemList[index], answer: answerIsNumber ? answerAsIndex : answer});
      }
      interact.close();
    });
  });
}

const answerToValue = {
  y: true,
  yes: true,
  Y: true,
  YES: true,
  n: false,
  no: false,
  N: false,
  NO: false,
};
const yesCondition = Object.entries(answerToValue)
  .filter(([, value]) => value === true)
  .map(it => it[0])
  .join('/');
const noCondition = Object.entries(answerToValue)
  .filter(([, value]) => value === false)
  .map(it => it[0])
  .join('/');

interface TipItem {
  content: LoggableContent;
  style: ColorStyle;
}
export async function goOnOrNot(config?: {
  tips?: Array<LoggableContent | TipItem>;
  style?: ColorStyle;
  defaultValue?: boolean;
}): Promise<boolean> {
  const {tips = [], defaultValue, style = {}} = config ?? {};
  const defaultStyle: ColorStyle = {
    color: 'yellow',
    ...style,
  };
  const optionStr = [...tips, `Go on or Not?[${defaultValue ? yesCondition : noCondition}]?`]
    .map(it => {
      const tipItem: TipItem = isObject(it)
        ? (it as TipItem)
        : {
            content: it,
            style: defaultStyle,
          };
      return coloringContent(tipItem.style, tipItem.content);
    })
    .join('\n');
  const interact = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<boolean>(res => {
    interact.question(optionStr, answer => {
      if (answer.trim() === '' && defaultValue !== undefined) {
        res(defaultValue);
      } else {
        res(answerToValue[answer] ?? false);
      }
      interact.close();
    });
  });
}

export function getBufferMatcher(target: CanConvertToBuffer) {
  const values = [...toBuffer(target)] as number[];
  if (values.length === 0) {
    throw new Error(`target is Empty`);
  }
  let index = 0;
  function resetIndex() {
    index = 0;
  }
  return (n: number | string) => {
    n = !isNumber(n) ? Buffer.from(n as string)[0] : n;
    if (n === values[index]) {
      index++;
    } else {
      /** reset index when current match fail */
      resetIndex();
    }
    const matched = index === values.length;
    /** reset index when all matched success  */
    if (matched) {
      resetIndex();
    }
    return matched;
  };
}

export async function calDuration<T>(promise: Promise<T>) {
  const start = Date.now();
  const res = await promise;
  const end = Date.now();
  console.log(`time used ${end - start}`);
  return res;
}

export function rerequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}
