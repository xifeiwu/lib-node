import {LogColors, logWithColor} from './log';

export function testLogWithColor() {
  const colors: LogColors[] = ['red', 'yellow', 'green', 'blue', 'magenta', 'cyan', 'black'];
  colors.forEach(color => {
    logWithColor(color, {color, colors});
  });
}
