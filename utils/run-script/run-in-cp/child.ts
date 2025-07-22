import {logColorful} from '../../../log';
import {InfoToCp, RunScriptParams} from '../../../types';
import {runTsScript} from '../run-ts-script';

const TAG = 'OUT_OF_FUNCTION';

/**
 * This script works together with main.ts, it can't be used directly
 */
export async function start() {
  let ipcMessage: InfoToCp<RunScriptParams> = {};
  if (process.send) {
    ipcMessage = await new Promise<InfoToCp<RunScriptParams>>(res => {
      process.once('message', (chunk: InfoToCp<RunScriptParams>) => {
        res(chunk);
      });
      /** Wait message for one second at most */
      setTimeout(() => {
        res(null);
      }, 1000);
    });
  }
  if (!ipcMessage) {
    return;
  }
  const {config} = ipcMessage;
  const [scriptPath, options] = config;

  if (process.connected && process.send) {
    /** Child process will exit by the error EPipe if the error is not catched here */
    process.send(
      `start run command in child process: ${[scriptPath, options?.funcName, ...(options?.funcParams ?? [])]
        .filter(Boolean)
        .join(' ')}`
    );
  }

  try {
    const result = await runTsScript(scriptPath, options);
    console.log('');
    console.log(TAG);
    console.log(result);
    console.log('------');
  } catch (err) {
    console.log(`${TAG} catch Error:`);
    logColorful({color: 'red'}, err.message);
    console.error(err);
    throw err;
  }
}

/**
 * Avoid run script when import
 */
if (process.env.SPAWNED_BY) {
  start();
}
