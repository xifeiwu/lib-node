import {isNumber, waitFor} from '../../../external';
import {logColorful} from '../../../log';
import {CP} from '../../../types';

export function outputInfo(
  value: any,
  channel?: {
    stdout?: boolean;
    ipc?: boolean;
  }
) {
  const {stdout = true, ipc = true} = channel ?? {};
  if (stdout) {
    logColorful({}, value);
  }
  if (ipc && process.connected && process.send) {
    /** Child process will exit by the error EPipe if the error is not catched here */
    process.send(value, err => {
      console.log(`err`);
      console.log(err);
    });
  }
}

/**
 * customize child process behavior by key-value pairs in config
 */
export async function handleCpCustomization(config?: CP.CpCustomization, key?: string) {
  if (!config || !key) {
    return;
  }
  const value = config[key];
  if (key === 'delay' && isNumber(value)) {
    await waitFor(value as number);
  } else if (key === 'errorMessage' && value !== undefined) {
    throw new Error(value as string);
  } else if (key === 'maxLifeCycle' && isNumber(value)) {
    const {exitCode} = config;
    setTimeout(() => {
      process.exit(exitCode ?? 0);
    }, value as number);
  } else if (key === 'exitCode') {
    return;
  }
}

export function getErrorMessage(err: Error | string) {
  let message = err as string;
  if (err instanceof Error) {
    message = err.stack ? err.stack : err.message;
  }
  return message;
}

export function getErrorResponse(err: Error | string) {
  return {
    type: 'error',
    data: getErrorMessage(err),
  };
}
