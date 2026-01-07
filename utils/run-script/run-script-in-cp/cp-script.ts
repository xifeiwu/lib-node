import fs from 'fs';
import path from 'path';
import {logColorful} from '../../../log';
import {RunScriptOptions} from '../../../types';
import {runScriptOnNode} from '../run-script';
import {RunScriptInCpParams} from './types';

const TAG = 'OUT_OF_FUNCTION';

/**
 * This script works together with main.ts, it can't be used directly
 */
export async function start() {
  let ipcMessage: RunScriptInCpParams;
  if (process.send) {
    ipcMessage = await new Promise<RunScriptInCpParams>(res => {
      process.once('message', (chunk: RunScriptInCpParams) => {
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
  let preScript: string;
  if (ipcMessage) {
    scriptPath = ipcMessage.scriptPath;
    options = ipcMessage.runScriptOptions;
    if (ipcMessage.preScript) {
      preScript = path.resolve(process.cwd(), ipcMessage.preScript);
    }
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
    if (preScript !== undefined) {
      if (!fs.existsSync(preScript)) {
        throw new Error(`preScript not exist: ${preScript}`);
      }
      /**
       * the main script should run after the end of pre-script, so selectExportedFunc should be set true
       */
      await runScriptOnNode(preScript, {
        selectExportedFunc: true,
        runTheOnlyFuncDirectly: true,
      });
    }
    const result = await runScriptOnNode(scriptPath, options);
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
