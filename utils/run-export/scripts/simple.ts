import {logColorful} from '../../../log';

export function consoleUsingRedColor() {
  logColorful({color: 'red'}, {a: 1});
}

export function consoleUsingBlueColor() {
  logColorful({color: 'blue'}, {a: 1});
}
