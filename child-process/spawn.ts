import fs from 'fs';
import path from 'path';
import {spawn} from 'child_process';
import {findClosestFile} from '../fs';
import {isBoolean, isNumber, isString} from '../external';
import {
  InfoToCp,
  SpawnAndIpcConfig,
  SpawnAndTryIpcResponse,
  SerializableSpawnInfo,
  IpcConfig,
  SpawnConfig,
  TsNodeOptions,
  SpawnScriptOptions,
  SpawnResult,
} from '../types';
import {getFilePathInfo} from '../path';

/**
 * Infer ts-node params by script if it run on ts-node runtime
 * -r, and --project are must to have params for ts-node, for its value:
 * 1. null means should have this value, but is unknown at current phase
 * 2. undefined means the param is not needed
 */
const defaultTsNodeOptions: TsNodeOptions = {
  '-r': null,
  '--project': null,
};
export function getTsNodeParams(
  tsFilePath: string,
  options?: Pick<SpawnScriptOptions<TsNodeOptions>, 'runtimeOptions'>
) {
  const {runtimeOptions = {}} = options ?? {};
  const fullPath = path.resolve(process.cwd(), tsFilePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`path not exist: ${fullPath}`);
  }
  const mergedTsNodeOptions = {...defaultTsNodeOptions, ...runtimeOptions};

  const dirPath = path.dirname(fullPath);
  if (Object.prototype.hasOwnProperty.call(mergedTsNodeOptions, '-r') && mergedTsNodeOptions['-r'] === null) {
    let tsConfigPathsRegister = findClosestFile(dirPath, 'node_modules/tsconfig-paths/register.js');
    if (!tsConfigPathsRegister) {
      /** use global tsconfig-paths if it's not a dependency of project */
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
  return tsNodeParams;
}

/**
 * Convert from SpawnFileOptions to SpawnConfig
 * spawn a script by info get from its path:
 * get command by file extname
 */
export function getSpawnConfigByScript<RunTimeOptions = any>(
  scriptPath: string,
  options?: SpawnScriptOptions<RunTimeOptions>
): SpawnConfig {
  const fullPath = path.resolve(process.cwd(), scriptPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`script not exist: ${fullPath}`);
  }
  const {extname} = getFilePathInfo(fullPath);
  let command = '';
  let args: string[] = [];
  const {runtimeOptions, params = [], spawnOptions} = options ?? {};
  /** params should follow after fullPath */
  if (extname === '.ts') {
    command = 'ts-node';
    args = [...getTsNodeParams(fullPath, {runtimeOptions}), fullPath, ...params];
  } else if (extname === '.js') {
    command = 'node';
    args = [fullPath, ...params];
  } else {
    throw new Error(`Can't get spawn config by extname: ${extname}`);
  }
  return {
    command,
    args,
    spawnOptions,
  };
}

/**
 * @deprecated by getSpawnConfigByScript as it's more simple
 * Convert from SpawnFileOptions to SpawnConfig
 * spawn a script by info get from its path:
 * get command by file extname
 */
export function getSpawnConfigByScriptPath<RunTimeOptions = any>(
  scriptPath: string,
  options?: SpawnScriptOptions<RunTimeOptions>
): SpawnConfig {
  return getSpawnConfigByScript<RunTimeOptions>(scriptPath, options);
}

export function spawnScript<RunTimeOptions = any>(
  scriptPath: string,
  options?: SpawnScriptOptions<RunTimeOptions>
): SpawnResult {
  const spawnConfig = getSpawnConfigByScript(scriptPath, options);
  const {command, args, spawnOptions = {}} = spawnConfig;
  const childProcess = spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions,
  });
  const wholeScript = `${command} ${args.join(' ')}`;
  return {childProcess, spawnConfig, wholeScript};
}

/**
 * @deprecated by spawnScript, as this name is not very accurate
 * @param tsFilePath
 * @param options
 * @returns
 */
export function spawnTsFile(tsFilePath: string, options?: SpawnScriptOptions) {
  const {childProcess} = spawnScript(tsFilePath, options);
  return childProcess;
}

/**
 * @deprecated by getSpawnAndIpcConfigByScript due to inaccurate function name
 */
export function getCpConfigByScriptPath<CpConfig = any>(
  fullPath: string,
  options?: SpawnScriptOptions & IpcConfig<CpConfig>
): SpawnAndIpcConfig<CpConfig> {
  return getSpawnAndIpcConfigByScript(fullPath, options);
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
export async function spawnAndTryIpc<CpConfig = any, ResponseFromCp = any>(
  config: SpawnAndIpcConfig<CpConfig>
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
    childProcess.once('error', err => {
      rej(err);
    });
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

/**
 * Get params for spawnAndTryIpc by scriptPath
 */
export function getSpawnAndIpcConfigByScript<CpConfig = any>(
  scriptPath: string,
  options?: SpawnScriptOptions & IpcConfig<CpConfig>
): SpawnAndIpcConfig<CpConfig> {
  const {infoToCp, maxWaitTime4Ipc, ...spawnTsFileOptions} = options;
  const spawnConfig = getSpawnConfigByScript(scriptPath, spawnTsFileOptions);
  return {
    ...spawnConfig,
    infoToCp,
    maxWaitTime4Ipc,
  };
}

export async function spawnScriptAndTryIpc<CpConfig = any, ResponseFromCp = any>(
  scriptPath: string,
  options?: SpawnScriptOptions & IpcConfig<CpConfig>
) {
  const spwanAndIpcConfig = getSpawnAndIpcConfigByScript<CpConfig>(scriptPath, options);
  return spawnAndTryIpc<CpConfig, ResponseFromCp>(spwanAndIpcConfig);
}
