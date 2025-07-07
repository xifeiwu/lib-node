import {execSync} from 'child_process';
import {logColorful} from '../log';

export function logCmdAndexecSync(cmd: string, options?: {throwError?: boolean}) {
  const {throwError = true} = options ?? {};
  logColorful({color: 'yellow'}, cmd);
  try {
    const result = execSync(cmd);
    return result;
  } catch (err) {
    const {stack, message} = err;
    if (throwError) {
      logColorful({color: 'red'}, process.cwd(), stack ?? message);
      throw err;
    }
  }
}
