import {logColorful} from '../../../log';
import {InfoToCp, RunScriptOptions, RunScriptParams} from '../../../types';
import {runScriptByPath} from '../run-script-by-path';

const TAG = 'OUT_OF_FUNCTION';

/**
 * This script works together with main.ts, it can't be used directly
 */
export async function start() {
  let ipcMessage: InfoToCp<RunScriptParams>;
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
  /**
   * Support get params in two way:
   * 1. passed from parent process
   * 2. parsed from process.argv
   */
  let scriptPath: string;
  let options: RunScriptOptions;
  if (ipcMessage) {
    const {config} = ipcMessage;
    [scriptPath, options] = config;
  } else {
    [, , scriptPath] = process.argv;
    options = {
      selectExportedFunc: true,
      funcParams: process.argv.slice(3),
    };
  }

  if (process.connected && process.send) {
    /** Child process will exit by the error EPipe if the error is not catched here */
    process.send(
      `start run command in child process: ${[scriptPath, options?.funcName, ...(options?.funcParams ?? [])]
        .filter(Boolean)
        .join(' ')}`
    );
  }

  try {
    const result = await runScriptByPath(scriptPath, options);
    console.log('');
    console.log(TAG);
    console.log(result);
    console.log('------');
  } catch (err) {
    console.log(`${TAG} catch Error:`);
    logColorful({color: 'red'}, err);
    console.error(err);
    throw err;
  }
}

start();
