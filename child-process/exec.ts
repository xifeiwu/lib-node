import fs from 'fs';
import {execSync} from 'child_process';
import {logColorful} from '../log';
import {convertToBuffer} from '../transform';

/**
 * Whether through error or not depends on the return value of shell command:
 * When the $? is not equal 0, execSync will throw Error.
 * So for some normally executed command, it may also throw Error, for example:
 * diff -uNra dir1 dir2
 * When there are different between two dir, the $? is 1, execSync will also throw Error,
 * so we should take care of case like this.
 */
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

export function diffDir(dir1: string, dir2: string) {
  const dirNotExist = [dir1, dir2].find(it => !fs.existsSync(it));
  if (dirNotExist) {
    throw new Error(`dir not exist: ${dirNotExist}`);
  }
  try {
    execSync(`diff -uNra ${dir1} ${dir2}`, {encoding: 'utf-8'});
    return '';
  } catch (e: any) {
    if (e.status === 1) {
      return e.stdout.toString();
    } else {
      throw new Error('diff command failed:', e.stderr?.toString() || e.message);
    }
  }
}
