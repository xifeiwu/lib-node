import fs from 'fs';
import {InfoToCp} from '../types';
import {isNumber} from '../external';

/**
 * For the case .ts file compiled to .js file, will use .js file first when running logic for the consideration of saving cost.
 */
export function tryUseJsFile(scriptPath: string) {
  let jsFilePath: string;
  if (scriptPath.endsWith('.ts')) {
    jsFilePath = scriptPath.replace(/ts$/, 'js');
  }
  if (jsFilePath && fs.existsSync(jsFilePath)) {
    return jsFilePath;
  }
  return scriptPath;
}

/**
 * Child Process wait ipc message frm Parent Process.
 * @param config
 * @returns
 */
export async function waitIpcMessageOnce<T = any>(config?: {maxWaitInSec?: number}) {
  const {maxWaitInSec: maxWait} = config ?? {};
  let ipcMessage: T;
  if (!process.send) {
    return undefined;
  }
  ipcMessage = await new Promise<T>(res => {
    process.once('message', (chunk: T) => {
      res(chunk);
    });
    if (isNumber(maxWait)) {
      /** Wait message for one second at most */
      setTimeout(() => {
        res(undefined);
      }, maxWait * 1000);
    }
  });
  return ipcMessage;
}
