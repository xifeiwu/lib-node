import fs from 'fs';
import path from 'path';
import {Serializable, spawn} from 'child_process';
import {findClosestFile} from '../fs';
import {isBoolean, isObject, isString} from '../external';
import {SpawnAndTryIpcConfig, SpawnAndTryIpcResponse, SpawnRelatedInfo} from '../types';

/** Existing key with a null value means should give a default value by program */
interface TsNodeOptions {
  '-r'?: string | null;
  '--project'?: string | null;
  '--transpileOnly'?: boolean;
}

export interface SpawnTsFileOptions {
  tsNodeOptions?: TsNodeOptions;
  printCommand?: boolean;
  params?: string[];
  spawnOptions?: Parameters<typeof spawn>[2];
}
const defaultSpwanTsFileOptions: SpawnTsFileOptions = {
  printCommand: false,
  params: [],
  spawnOptions: {},
};
const defaultTsNodeOptions: TsNodeOptions = {
  '-r': null,
  '--project': null,
};
export function getTsParams(
  execPath: string,
  options?: Pick<SpawnTsFileOptions, 'tsNodeOptions' | 'params'>
) {
  const {tsNodeOptions = {}, params = []} = options ?? {};
  const fullExecPath = execPath.startsWith('/') ? execPath : path.resolve(process.cwd(), execPath);
  if (!fs.existsSync(fullExecPath)) {
    throw new Error(`path not exist: ${fullExecPath}`);
  }
  const mergedOptions = {...defaultSpwanTsFileOptions, ...options};
  const mergedTsNodeOptions = {...defaultTsNodeOptions, ...tsNodeOptions};

  const dirPath = path.dirname(fullExecPath);
  if (Object.prototype.hasOwnProperty.call(mergedTsNodeOptions, '-r') && mergedTsNodeOptions['-r'] === null) {
    let tsConfigPathsRegister = findClosestFile(dirPath, 'node_modules/tsconfig-paths/register.js');
    if (!tsConfigPathsRegister) {
      const {NVM_BIN} = process.env;
      if (NVM_BIN) {
        tsConfigPathsRegister = path.resolve(NVM_BIN, '../lib/node_modules/tsconfig-paths/register.js');
      }
    }
    if (fs.existsSync(tsConfigPathsRegister)) {
      mergedTsNodeOptions['-r'] = tsConfigPathsRegister;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(mergedTsNodeOptions, '--project') &&
    mergedTsNodeOptions['--project'] === null
  ) {
    mergedTsNodeOptions['--project'] = findClosestFile(dirPath, 'tsconfig.json');
  }

  const tsNodeParams: string[] = [];
  Object.entries(mergedTsNodeOptions).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    if (isString(value)) {
      tsNodeParams.push(key, value as string);
    } else if (isBoolean(value)) {
      tsNodeParams.push(key);
    }
  });
  const fileExecParams = [fullExecPath, ...params];
  const allParams = [...tsNodeParams, ...fileExecParams];
  return allParams;
}

export function spawnTsFile(execPath: string, options?: SpawnTsFileOptions) {
  const {printCommand, spawnOptions = {}, tsNodeOptions, params} = options ?? {};
  const allParams = getTsParams(execPath, {tsNodeOptions, params});
  const childProcess = spawn('ts-node', allParams, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions,
  });
  if (printCommand) {
    console.log(`[${process.pid}]spawn command[${childProcess.pid}]: ts-node ${allParams.join(' ')}`);
  }
  return childProcess;
}

// interface SpawnConfig
export async function spawnAndTryIpc<InfoToCp = any, ResponseFromCp = any>(
  config: SpawnAndTryIpcConfig<InfoToCp>
): Promise<SpawnAndTryIpcResponse<ResponseFromCp>> {
  const {command, args, spawnOptions, waitFirstIpc, infoToCp} = config;
  const childProcess = spawn(command, args, spawnOptions);
  const supportIpc = Boolean(childProcess.send);
  /**
   * Notice of supportIpc
   * For Main process, **must** send config to child process, and wait for response from child process
   * For child process, receive ipc message, and **must** send response to Main process.
   */
  if (supportIpc && infoToCp) {
    childProcess.send(infoToCp);
  }
  const info: SpawnAndTryIpcResponse<ResponseFromCp> = {
    ...config,
    childProcess,
  };
  if (!waitFirstIpc) {
    return info;
  }
  return new Promise<SpawnAndTryIpcResponse<ResponseFromCp>>((res, rej) => {
    const messageLisnter = chunk => {
      /** error message */
      if (!isObject(chunk)) {
        rej(chunk);
        return;
      }
      info.responseFromCp = chunk as ResponseFromCp;
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

export function toSpawnRelatedInfo<ResponseFromCp = any>(
  response: SpawnAndTryIpcResponse<ResponseFromCp>
): SpawnRelatedInfo {
  const {childProcess, ...rest} = response;
  return {
    pid: childProcess.pid,
    ...rest,
  };
}
