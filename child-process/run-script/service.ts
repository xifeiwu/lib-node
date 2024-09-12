import path from 'path';
import {getFileList, isNumber, isObject, toConsole, waitFor} from '../../index';
import {ChildProcessInfo, CpCustomization, RunTsScriptConfig, ScriptFileName} from './types';
import {spawn, SpawnOptions} from 'child_process';
import {getTsParams} from '../../index';

/** For child process */
export function out(value: any) {
  toConsole(value);
  process.send && process.send(value);
}

export async function getScriptFullpath(basename: ScriptFileName) {
  if (!basename.endsWith('.ts')) {
    basename += '.ts';
  }
  const scriptDir = path.join(__dirname);
  const fileList = getFileList(scriptDir, {
    fileFilter({basename}) {
      return basename !== 'index.ts';
    },
  });
  if (!fileList.includes(basename)) {
    throw new Error(`file ${basename} not in fileList: [${fileList.join(', ')}]`);
  }
  return path.resolve(scriptDir, basename);
}

export async function runCpCustomization(config?: CpCustomization) {
  config = config ?? {};
  const keys = Object.keys(config) as Array<keyof CpCustomization>;
  for (const key of keys) {
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
      continue;
    }
  }
}

export async function runTsScriptInChildProcess<CpConfig = any, CpResponse = any>(
  basename: ScriptFileName,
  config?: RunTsScriptConfig<CpConfig>
) {
  const {spawnOptions, args, infoToCp} = config;
  const scriptPath = await getScriptFullpath(basename);
  const params = getTsParams(scriptPath);
  if (args) {
    params.push(...args);
  }
  const mergedSpawnOptions: SpawnOptions = {
    ...(spawnOptions ?? {}),
  };
  const command = 'ts-node';
  const childProcess = spawn(command, params, mergedSpawnOptions);
  const supportIpc = Boolean(childProcess.send);

  /**
   * Notice of supportIpc
   * For Main process, **must** send config to child process, and wait for response from child process
   * For child process, receive ipc message, and **must** send response to Main process.
   */
  if (supportIpc && infoToCp) {
    childProcess.send(infoToCp);
  }

  const info: ChildProcessInfo<CpResponse> = {
    command,
    params,
    spawnOptions: mergedSpawnOptions,
    pid: childProcess.pid,
    childProcess,
  };
  return new Promise<ChildProcessInfo<CpResponse>>((res, rej) => {
    const messageLisnter = chunk => {
      /** error message */
      if (!isObject(chunk)) {
        rej(chunk);
        return;
      }
      info.childProcessResponse = chunk as CpResponse;
      res(info);
    };
    /** Child process must send process info when run successful, or process will hang here. */
    if (supportIpc) {
      childProcess.on('message', chunk => {
        messageLisnter(chunk);
        childProcess.off('message', messageLisnter);
      });
    } else {
      res(info);
    }
  });
}
