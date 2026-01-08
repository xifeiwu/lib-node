import fs from 'fs';
import {isNumber} from '../external';
import {ChildProcess} from 'child_process';

/**
 * @deprecated by getPreferredFileByExt
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
 * Wait for ipc message once, until maxWaitInSec elapsed.
 * One point need to take care about is when maxWaitInSec is passed, the whole process will be 
 * blocked for maxWaitInSec seconds if message event is not triggered on process
 */
export async function waitIpcMessageOnce<T = any>(config?: {
  p?: NodeJS.Process | ChildProcess;
  maxWaitInSec?: number;
}) {
  const {p = process, maxWaitInSec} = config ?? {};
  let ipcMessage: T;
  // if (process.env.spawnBy !== 'node') {
  //   return undefined;
  // }
  if (!p.connected || !p.send) {
    return undefined;
  }
  let timeoutTag: NodeJS.Timeout;
  ipcMessage = await new Promise<T>(res => {
    p.once('message', (chunk: T) => {
      res(chunk);
      if (timeoutTag) {
        clearTimeout(timeoutTag);
      }
    });
    if (isNumber(maxWaitInSec)) {
      /** Wait message for one second at most */
      timeoutTag = setTimeout(() => {
        res(undefined);
      }, maxWaitInSec * 1000);
    }
  });
  return ipcMessage;
}
