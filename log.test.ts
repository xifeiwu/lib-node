import {logWithColor} from './log';

export function testLogWithColor() {
  const colors: string[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
  colors.forEach(color => {
    // @ts-ignore
    logWithColor(color, {color, colors});
  });
}
