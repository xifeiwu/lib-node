import {execSync} from 'child_process';
import {logColorful} from '../log';
import {convertToBuffer} from '../transform';
import {ExecCmdOptions} from '../types';

/**
 * @deprecated by execCmdWithOptions
 * @param cmd
 * @param options
 * @returns
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

/**
 * Whether through error or not depends on the return value of shell command:
 * When the $? is not equal 0, execSync will throw Error.
 * So for some normally executed command, it may also throw Error, for example:
 * diff -uNra dir1 dir2
 * When there are different between two dir, the $? is 1, execSync will also throw Error,
 * so we should take care of case like this.
 */
export function execCmdWithOptions(cmd: string, options?: ExecCmdOptions) {
  const {more, ...execOptions} = options ?? {};
  const {log, ignoreStatus} = more ?? {};
  log && logColorful({color: 'black'}, 'will run command in shell:', cmd);
  try {
    const result = execSync(cmd, execOptions);
    return result;
  } catch (err) {
    const {status, stack, stdout, message} = err;
    if (status !== undefined && Array.isArray(ignoreStatus) && ignoreStatus.includes(status)) {
      return stdout;
    } else {
      logColorful(
        {color: 'red'},
        `execute shell command ends with status: ${status}`,
        process.cwd(),
        stack ?? (stdout ? stdout.toString() : null) ?? message
      );
      throw err;
    }
  }
}
