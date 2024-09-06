import path from 'path';
import {getFileList, isObject, toConsole} from '../../index';
import {ChildProcessInfo, MessageToCp, RunTsScriptConfig, ScriptFileName} from './types';
import {ChildProcess, spawn, SpawnOptions} from 'child_process';
import {getTsParams} from '../index';

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

export async function runTsScriptInChildProcess<T extends any = any>(
  basename: ScriptFileName,
  config?: RunTsScriptConfig
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

  const info: ChildProcessInfo<T> = {
    command,
    params,
    spawnOptions: mergedSpawnOptions,
    pid: childProcess.pid,
    childProcess,
  };
  return new Promise<ChildProcessInfo<T>>((res, rej) => {
    const messageLisnter = chunk => {
      /** error message */
      if (!isObject(chunk)) {
        rej(chunk);
        return;
      }
      info.childProcessResponse = chunk as T;
      res(info);
    };
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
