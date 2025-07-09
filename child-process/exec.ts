import {execSync} from 'child_process';
import {logColorful} from '../log';
import {convertToBuffer} from '../transform';

export function logCmdAndexecSync(cmd: string, options?: {throwError?: boolean}) {
  const {throwError = true} = options ?? {};
  logColorful({color: 'yellow'}, cmd);
  try {
    const result = execSync(cmd);
    return result;
  } catch (err) {
    const {stderr, stdout} = err;
    if (throwError) {
      const message = convertToBuffer(stdout ?? stderr).toString();
      logColorful({color: 'red'}, message);
      throw new Error(message);
    }
  }
}
