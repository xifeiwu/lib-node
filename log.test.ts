import {logWithColor} from './log';
import {LogColors} from './types';

export function testLogWithColor() {
  const colors: LogColors[] = ['red', 'yellow', 'green', 'blue', 'magenta', 'cyan', 'black'];
  colors.forEach(color => {
    logWithColor(color, {color, colors});
  });
}
