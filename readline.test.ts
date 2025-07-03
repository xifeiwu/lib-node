import {logColorful} from './log';
import {selectOption} from './readline';

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
