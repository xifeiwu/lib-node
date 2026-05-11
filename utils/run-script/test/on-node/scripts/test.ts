import {logColorful} from '../../../../../log';

export function add1(value?: number) {
  const result = (value ?? 0) + 1;
  logColorful({color: 'red'}, result);
  return result;
}

export function add2(value?: number) {
  const result = (value ?? 0) + 2;
  logColorful({color: 'red'}, result);
  return result;
}
