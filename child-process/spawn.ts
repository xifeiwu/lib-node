import fs from 'fs';
import path from 'path';
import {Serializable, spawn, SpawnOptions} from 'child_process';
import {findClosestFile} from '../fs';
import {isBoolean, isNumber, isObject, isString} from '../external';
import {
  InfoToCp,
  SpawnAndTryIpcConfig,
  SpawnAndTryIpcResponse,
  SerializableSpawnInfo,
  IpcConfig,
} from '../types';
import {getFilePathInfo} from '../path';

/** Existing key with a null value means should give a default value by program */
interface TsNodeOptions {
  '-r'?: string | null;
  '--project'?: string | null;
  '--transpileOnly'?: boolean;
}

export interface SpawnTsFileOptions {
  tsNodeOptions?: TsNodeOptions;
  params?: string[];
  // spawnOptions?: Parameters<typeof spawn>[2];
  spawnOptions?: SpawnOptions;
  printCommand?: boolean;
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
  tsFilePath: string,
  options?: Pick<SpawnTsFileOptions, 'tsNodeOptions' | 'params'>
) {
  const {tsNodeOptions = {}, params = []} = options ?? {};
  const fullExecPath = tsFilePath.startsWith('/') ? tsFilePath : path.resolve(process.cwd(), tsFilePath);
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

export function getSpawnConfigByScriptPath(fullPath: string, options?: SpawnTsFileOptions) {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`file not exist: ${fullPath}`);
  }
  const suffix = path.basename(fullPath).split('.').pop().toLowerCase();
  let command = '';
  let args: string[] = [];
  const {tsNodeOptions, params = [], spawnOptions} = options ?? {};
  if (suffix === 'ts') {
    command = 'ts-node';
    args = getTsParams(fullPath, {tsNodeOptions, params});
  } else if (suffix === 'js') {
    command = 'node';
    args = [fullPath, ...params];
  }
  return {
    command,
    args,
    spawnOptions,
  };
}
export function getCpConfigByScriptPath<CpConfig = any>(
  fullPath: string,
  options?: SpawnTsFileOptions & IpcConfig<CpConfig>
): SpawnAndTryIpcConfig<CpConfig> {
  const {infoToCp, maxWaitTime4Ipc, ...spawnTsFileOptions} = options;
  const spawnConfig = getSpawnConfigByScriptPath(fullPath, spawnTsFileOptions);
  return {
    ...spawnConfig,
    infoToCp,
    maxWaitTime4Ipc,
  };
}

export function spawnTsFile(tsFilePath: string, options?: SpawnTsFileOptions & {printCommand: boolean}) {
  // const {printCommand, spawnOptions = {}, tsNodeOptions, params} = options ?? {};
  // const allParams = getTsParams(tsFilePath, {tsNodeOptions, params});
  const {command, args, spawnOptions = {}} = getCpConfigByScriptPath(tsFilePath, options);
  const childProcess = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions,
  });
  const {printCommand} = options ?? {};
  if (printCommand) {
    console.log(`[${process.pid}]spawn command[${childProcess.pid}]: ${command} ${args.join(' ')}`);
  }
  return childProcess;
}

/**
 * Child Process wait ipc message frm Parent Process.
 * @param config
 * @returns
 */
export async function waitParentMessageFromIPC<CpConfig>(config?: {maxWait?: number}) {
  const {maxWait = 6000} = config ?? {};
  let ipcMessage: InfoToCp<CpConfig> = {};
  if (process.send) {
    ipcMessage = await new Promise<InfoToCp<CpConfig>>(res => {
      process.once('message', (chunk: InfoToCp<CpConfig>) => {
        res(chunk);
      });
      /** Wait message for one second at most */
      setTimeout(() => {
        res({});
      }, maxWait);
    });
  }
  return ipcMessage;
}

/**
 * Focus on first conversation between Main and Child process:
 * Pass param from Main to Child process if supportIpc and infoToCp is not undefined
 * Return status from Child to Main process if supportIpc and maxWaitTime4Ipc is not undefined
 * @param config
 * @returns
 */
export async function spawnAndTryIpc<InfoToCp = any, ResponseFromCp = any>(
  config: SpawnAndTryIpcConfig<InfoToCp>
): Promise<SpawnAndTryIpcResponse<ResponseFromCp>> {
  const {command, args, spawnOptions, maxWaitTime4Ipc, infoToCp} = config;
  const childProcess = spawn(command, args, spawnOptions);
  const supportIpc = Boolean(childProcess.send);
  if (infoToCp && !supportIpc) {
    /** Shoule kill child process created when throw Error */
    childProcess.kill();
    throw new Error(`Please set ipc channel in spawnOption.stdio, or set infoToCp to false.`);
  }
  /** Send message to child process when supportIpc and infoToCp exist */
  if (supportIpc && infoToCp) {
    childProcess.send(infoToCp);
  }
  const info: SpawnAndTryIpcResponse<ResponseFromCp> = {
    spawnTime: '',
    childProcess,
  };
  await new Promise<void>((res, rej) => {
    childProcess.once('spawn', () => {
      info.spawnTime = new Date().toLocaleString();
      res();
    });
    childProcess.once('error', err => rej(err));
  });
  /**
   * Take care: child process **must** send response to IPC channel, or main process will hang here.
   */
  return new Promise<SpawnAndTryIpcResponse<ResponseFromCp>>((res, rej) => {
    const messageLisnter = chunk => {
      info.responseFromCp = chunk as ResponseFromCp;
      res(info);
    };
    /** Wait message of child process from IPC channel when supportIpc and maxWaitTime4Ipc is not undefined */
    if (supportIpc && isNumber(maxWaitTime4Ipc)) {
      const timeOutTag = setTimeout(
        () =>
          res({
            ...info,
            responseFromCp: new Error(
              `No message received from child process within ${maxWaitTime4Ipc}s`
            ) as ResponseFromCp,
          }),
        Math.abs(maxWaitTime4Ipc) * 1000
      );
      childProcess.once('message', chunk => {
        messageLisnter(chunk);
        clearTimeout(timeOutTag);
      });
    } else {
      res(info);
    }
  });
}

export function serializeSpawnResponse<ResponseFromCp = any>(
  response: SpawnAndTryIpcResponse<ResponseFromCp>
): SerializableSpawnInfo {
  if (!response) {
    return null;
  }
  const {childProcess, ...rest} = response;
  return {
    pid: childProcess.pid,
    ...rest,
  };
}
