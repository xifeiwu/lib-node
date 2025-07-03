import readline from 'readline';
import {isNumber, isObject, isString} from './external';
import {coloringContent, inspect} from './log';
import {CanConvertToBuffer, ColorStyle, LoggableContent} from './types';
import {toBuffer} from './transform';

/**
 * Get selected item by index or its label content
 */
export async function selectOption<T extends {label: string}>(
  itemList: T[],
  option?: {
    tip?: Array<any> | string;
    /**
     * @deprecated by defaultAnswer
     */
    defaultIndex?: number;
    defaultAnswer?: number | string;
  }
): Promise<T & {answer: number | string}> {
  const {tip = 'please select', defaultIndex, defaultAnswer = 0} = option ? option : {};
  let tipArr: string[] = [];
  if (isString(tip)) {
    // tip = [tip];
    tipArr.push(tip as string);
  } else {
    tipArr = (tip as Array<any>).map(it => inspect(it));
  }
  tipArr.push(`[default answer is ${defaultAnswer})]:`);
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
    interact.question(optionStr, (answer: string) => {
      let index: number;
      let parsedAnswer: number | string = answer;
      const useDefaultAnswer = answer.length === 0;
      /** 1. If there is no input, set defaultIndex as value index */
      if (useDefaultAnswer) {
        answer = defaultAnswer as string;
      }
      /** 2. Try answer as value of option label, and find index by label value */
      const i = itemList.findIndex(it => it.label === answer);
      if (i !== -1) {
        index = i;
      } else {
        /** 3. Try answer as option index */
        const answerAsIndex = parseInt(answer);
        if (Number.isInteger(answerAsIndex)) {
          index = answerAsIndex;
          parsedAnswer = answerAsIndex;
        }
      }
      // }
      interact.close();
      if (!itemList[index]) {
        rej(`Can't find option by input: ${answer}`);
      } else {
        res({...itemList[index], answer: useDefaultAnswer ? '' : parsedAnswer});
      }
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
