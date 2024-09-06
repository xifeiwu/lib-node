import path from 'path';
import {ChildProcess, spawn, SpawnOptions} from 'child_process';
import {getFileList, getTsParams, isObject} from '../index';
export * from './script-cp/types';

export type ScriptFileName = 'debug-server' | 'debug-server-cluster' | 'customizable' | 'echo-input';
/** The config will send to child process recurrsively */
export interface RunTsScriptConfig<CpConfig = any> {
  /** args of running child process */
  args?: string[];
  /** config for how to spawn child process */
  spawnOptions?: SpawnOptions;
  /** config send to child process by ipc channel */
  cpConfig?: CpConfig;
  /** config to run child process in child process */
  cpOfCpConfig?: RunTsScriptConfig;
}

/**
 * Ipc message send from Main process to child process
 */
export interface MessageToCp<CpConfig = any> {
  config?: CpConfig;
  cpConfig?: RunTsScriptConfig;
}
export interface ChildProcessInfo {
  command: string;
  params: string[];
  spawnOptions: SpawnOptions;
  pid: number;
}
export async function getScriptFullpath(basename: ScriptFileName) {
  if (!basename.endsWith('.ts')) {
    basename += '.ts';
  }
  const scriptDir = path.join(__dirname, 'script-cp');
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

type ProcessInfo<T> = ChildProcessInfo & {
  childProcess: ChildProcess;
  childProcessResponse?: T;
};
export async function runTsScriptInChildProcess<T extends any = any>(
  basename: ScriptFileName,
  config?: RunTsScriptConfig
) {
  const {spawnOptions, args, cpConfig, cpOfCpConfig} = config;
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
  if (supportIpc) {
    const ipcMessage: MessageToCp = {config: cpConfig};
    if (cpOfCpConfig) {
      ipcMessage.cpConfig = {args, ...cpOfCpConfig};
    }
    childProcess.send(ipcMessage);
  }

  const info: ProcessInfo<T> = {
    command,
    params,
    spawnOptions: mergedSpawnOptions,
    pid: childProcess.pid,
    childProcess,
  };
  return new Promise<ProcessInfo<T>>((res, rej) => {
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
