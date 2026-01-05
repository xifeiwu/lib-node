import fs from 'fs';
import path from 'path';
import {Serializable, spawn} from 'child_process';
import {findClosestFile} from '../fs';
import {isBoolean, isNumber, isString} from '../external';
import {
  SpawnAndTryIpcResponse,
  SerializableSpawnInfo,
  IpcConfig,
  SpawnConfig,
  TsNodeOptions,
  SpawnScriptOptions,
  SpawnResult,
} from '../types';
import {getFilePathInfo} from '../path';
import {waitIpcMessageOnce} from './service';

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
  const {runtimeOptions, params = [], ...rest} = options ?? {};
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
    ...rest,
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

/**
 * @deprecated by spawnAndTryIpc
 * @param scriptPath
 * @param options
 * @returns
 */
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
): SpawnConfig<CpConfig> {
  return getSpawnAndIpcConfigByScript(fullPath, options);
}

/**
 * Focus on first conversation between Main and Child process:
 * Pass param from Main to Child process if supportIpc and infoToCp is not undefined
 * Return status from Child to Main process if supportIpc and maxWaitTime4Ipc is not undefined
 * @param config
 * @returns
 */
export async function spawnAndTryIpc<CpConfig extends Serializable = any, ResponseFromCp = any>(
  config: SpawnConfig<CpConfig>
): Promise<SpawnAndTryIpcResponse<ResponseFromCp>> {
  const {command, args, spawnOptions, minUptime = 0, infoToCp} = config;
  const maxWaitCpResInSec = config.maxWaitCpResInSec ?? config.maxWaitTime4Ipc;
  const childProcess = spawn(command, args, {...spawnOptions});
  const supportIpc = Boolean(childProcess.connected && childProcess.send);
  if (!supportIpc && [infoToCp, maxWaitCpResInSec].some(it => it !== undefined)) {
    /** Shoule kill child process created when throw Error */
    childProcess.kill();
    throw new Error(`params infoToCp and maxWaitCpResInSec not work while ipc channel is off`);
  }
  /** Send message to child process when supportIpc and infoToCp exist */
  if (supportIpc && infoToCp) {
    childProcess.send(infoToCp);
  }
  const wholeScript = `${command} ${args.join(' ')}`;
  const info: SpawnAndTryIpcResponse = {
    wholeScript,
    childProcess,
    supportIpc,
    spawnTime: '',
  };
  let timeoutToResolve: NodeJS.Timeout;
  function handleException(errInfo: {code: number; event: string}) {
    if (timeoutToResolve) {
      clearTimeout(timeoutToResolve);
    }
    const {event, code} = errInfo;
    return new Error(
      `child process ${event} with status code: ${code}, you can debug using command: ${wholeScript}`
    );
  }
  let waitResPromise: Promise<ResponseFromCp>;
  await new Promise<void>((res, rej) => {
    childProcess.once('spawn', () => {
      info.spawnTime = new Date().toLocaleString();
      timeoutToResolve = setTimeout(() => {
        res();
      }, minUptime);
      waitResPromise = new Promise<ResponseFromCp>(async (res, rej) => {
        /** Wait message of child process from IPC channel when supportIpc and maxWaitTime4Ipc is not undefined */
        if (supportIpc && isNumber(maxWaitCpResInSec)) {
          const responseFromCp = await waitIpcMessageOnce({
            p: childProcess,
            maxWaitInSec: maxWaitCpResInSec,
          });
          res(responseFromCp);
        } else {
          res(undefined);
        }
      });
    });
    childProcess.once('exit', (code, signal) => {
      rej(handleException({event: 'exit', code}));
    });
    childProcess.once('close', (code, signal) => {
      rej(handleException({event: 'close', code}));
    });
    childProcess.once('error', err => {
      rej(err);
    });
  });
  if (waitResPromise) {
    info.responseFromCp = await waitResPromise;
  }
  return info;
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
 * @deprecated by getSpawnConfigByScript
 * Get params for spawnAndTryIpc by scriptPath
 */
export function getSpawnAndIpcConfigByScript<CpConfig = any>(
  scriptPath: string,
  options?: SpawnScriptOptions
): SpawnConfig<CpConfig> {
  const spwanAndIpcConfig = getSpawnConfigByScript<CpConfig>(scriptPath, options);
  return spwanAndIpcConfig;
}

export async function spawnScriptAndTryIpc<CpConfig extends Serializable = any, ResponseFromCp = any>(
  scriptPath: string,
  options?: SpawnScriptOptions
) {
  const spwanAndIpcConfig = getSpawnConfigByScript<CpConfig>(scriptPath, options);
  return spawnAndTryIpc<CpConfig, ResponseFromCp>(spwanAndIpcConfig);
}
