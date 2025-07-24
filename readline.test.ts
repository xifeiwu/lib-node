import {logColorful} from './log';
import {goOnOrNot, selectOption} from './readline';

export async function runSelectOption() {
  const options = [
    {
      label: 'aaa',
      value: 'a',
    },
    {
      label: 'bbb',
      value: 'b',
    },
  ];
  const selection = await selectOption(options, {tip: 'Please one as answer'});
  logColorful({color: 'red'}, 'selection:', selection);
}

/**
 * Show
 * 1. How question mark impact tip message
 * 2. The usage of defaultValue
 */
export async function runGoOnOrNot() {
  const current = new Date().toISOString();
  const answer1 = await goOnOrNot({
    tips: [`Current time is ${current}`],
  });
  logColorful({}, answer1);
  const answer2 = await goOnOrNot({
    tips: [`Current time is ${current}?`],
    defaultValue: true,
  });
  logColorful({}, answer2);
}
