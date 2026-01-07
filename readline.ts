import readline from 'readline';
import {isNumber} from './external';
import {coloringContent, loggableContentToStr, toContentWithStyle} from './log';
import {ColorStyle, ContentWitStyle, LoggableContent} from './types';

export async function showQuestionAndGetAnswer(question: string, defaultAnswer?: string): Promise<string> {
  const interact = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    // terminal: false,
  });
  const answer = await new Promise<string>(res => {
    interact.question(question, (answer: string) => {
      res(answer);
      interact.close();
    });
  });
  return answer.length === 0 && defaultAnswer !== undefined ? defaultAnswer : answer;
}

/**
 * Get selected item by index or its label content
 * @returns answer, is the value from user input,
 * it's value is '' if there is no use input(e.g., just press enter to use default value),
 * will try to convert to int, if success will treat it as index value
 */
export async function selectOption<T extends {label: string}>(
  itemList: T[],
  option?: {
    tips?: Array<LoggableContent | ContentWitStyle>;
    /**
     * @deprecated by defaultAnswer
     */
    defaultIndex?: number;
    defaultAnswer?: number | string;
    doubleConfirmForAmbiguousCases?: boolean;
  }
): Promise<T & {answer: number | string}> {
  const {
    tips = ['please select'],
    defaultIndex,
    defaultAnswer = 0,
    doubleConfirmForAmbiguousCases,
  } = option ? option : {};
  const defaultAnswerTip = `[default answer is ${defaultAnswer})]:`;
  const formattedTips = toContentWithStyle(tips, {color: 'yellow'});
  if (Array.isArray(formattedTips) && formattedTips.length > 0) {
    formattedTips[tips.length - 1].content =
      loggableContentToStr(formattedTips[tips.length - 1].content) + defaultAnswerTip;
  }
  const optionStr = [
    ...itemList.map<ContentWitStyle>((it, index) => {
      return {content: `${index}. ${String(it.label ? it.label : it)}`};
    }),
    ...formattedTips,
  ]
    .map(it => coloringContent(it.style, it.content))
    .join('\n');

  let answer = await showQuestionAndGetAnswer(optionStr);
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
  const selectedItem = itemList[index];
  if (selectedItem === undefined) {
    throw new Error(`Can't find option by input: ${answer}`);
  }
  const result = {...selectedItem, answer: useDefaultAnswer ? '' : parsedAnswer};
  /** Double confirm if function name is selected by option index */
  if (
    doubleConfirmForAmbiguousCases &&
    (isNumber(result.answer) || useDefaultAnswer) &&
    !(await goOnOrNot({
      style: {
        color: 'red',
      },
      tips: [`your selection is ${selectedItem.label}?`],
      defaultValue: true,
    }))
  ) {
    throw new Error(`Manually Interrupt`);
  }
  return result;
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

export async function goOnOrNot(config?: {
  tips?: Array<LoggableContent | ContentWitStyle>;
  style?: ColorStyle;
  defaultValue?: boolean;
}): Promise<boolean> {
  const {tips = [], defaultValue, style = {}} = config ?? {};
  const defaultStyle: ColorStyle = {
    color: 'yellow',
    ...style,
  };
  const formattedTips = toContentWithStyle(tips, defaultStyle);
  /**
   * if the last content ends with ?, append default value to last content
   * or append a new formatted line
   */
  if (
    formattedTips.length > 0 &&
    loggableContentToStr(formattedTips[formattedTips.length - 1].content).endsWith('?')
  ) {
    formattedTips[formattedTips.length - 1].content += `[${defaultValue ? yesCondition : noCondition}]?`;
  } else {
    formattedTips.push({
      content: `Go on or Not?[${defaultValue ? yesCondition : noCondition}]?`,
      style: defaultStyle,
    });
  }

  const optionStr = formattedTips.map(it => coloringContent(it.style, it.content)).join('\n');
  const answer = await showQuestionAndGetAnswer(optionStr);
  if (answer.trim() === '' && defaultValue !== undefined) {
    return defaultValue;
  } else {
    return answerToValue[answer] ?? false;
  }
}
