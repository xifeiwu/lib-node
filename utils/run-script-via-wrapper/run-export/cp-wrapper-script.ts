import fs from 'fs';
import path from 'path';
import {logColorful} from '../../../log';
import {RunTargetScriptOptions} from '../types';
import {runTargetScriptOnNode} from '../run-node-script';
import type {NodeCpWrapScriptOptions} from '../types';

const TAG = 'OUT_OF_FUNCTION';

/**
 * This script works together with main.ts, it can't be used directly
 */
export async function start() {
  let ipcMessage: NodeCpWrapScriptOptions;
  if (process.send) {
    ipcMessage = await new Promise<NodeCpWrapScriptOptions>(res => {
      process.once('message', (chunk: NodeCpWrapScriptOptions) => {
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
   * 1. passed from parent process through ipc(suggessted)
   * 2. parsed from process.argv
   */
  let scriptPath: string;
  let options: RunTargetScriptOptions = {};
  let preScript: string;
  if (ipcMessage) {
    if (ipcMessage.preScript) {
      preScript = path.resolve(process.cwd(), ipcMessage.preScript);
    }
    options = ipcMessage.runTargetScriptOptions;
  }
  /**
   * runTargetScriptOptions in command line have higher priority than ipcMessage
   * [
   *   '/Users/wuxifei/.nvm/versions/node/v24.12.0/bin/ts-node',
   *   '/Users/wuxifei/code/node/tool/busybox/modules/lib/node/utils/run-script-via-wrapper/run-export/cp-wrapper-script.ts',
   *   '/Users/wuxifei/code/node/tool/busybox/src/run-in-cp/test/project/index.ts',
   *   'add1',
   *   '10'
   * ]
   */
  if (process.argv.length > 2) {
    [, , scriptPath] = process.argv;
    const funcName = process.argv[3];
    if (funcName) {
      options.funcName = funcName;
      // One issue about pass function params is the types of all item in params are string.
      // options.funcParams = process.argv.slice(4);
    }
  }

  try {
    if (preScript !== undefined) {
      if (!fs.existsSync(preScript)) {
        throw new Error(`preScript not exist: ${preScript}`);
      }
      /**
       * the main script should run after the end of pre-script, so selectExportedFunc should be set true
       */
      await runTargetScriptOnNode(preScript, {
        runExportedFunc: true,
        runTheOnlyFuncDirectly: true,
      });
    }
    const result = await runTargetScriptOnNode(scriptPath, options);
    console.log('');
    console.log(TAG);
    console.log(result);
    console.log('------');
    if (process.connected && process.send) {
      /** Child process will exit by the error EPipe if the error is not catched here */
      process.send(result, err => {
        if (err) {
          console.log(err);
        }
      });
    }
  } catch (err) {
    console.log(`${TAG} catch Error:`);
    logColorful({color: 'red'}, err);
    console.error(err);
    throw err;
  }
}

start();
