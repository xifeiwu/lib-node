import path from 'path';
import {
  getFileList,
  isNumber,
  isObject,
  spawnAndTryIpc,
  SpawnAndTryIpcConfig,
  SpawnConfig,
  toConsole,
  waitFor,
} from '../../index';
import {CpCustomization, SpawnTsScriptConfig, ScriptFileName} from './types';
import {spawn, SpawnOptions} from 'child_process';
import {getTsParams, SpawnAndTryIpcResponse} from '../../index';

/** For child process */
export function out(value: any) {
  toConsole(value);
  process.send && process.send(value);
}

export function getScriptFullpath(basename: ScriptFileName) {
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

export async function runAllCpCustomization(config?: CpCustomization) {
  config = config ?? {};
  const keys = Object.keys(config) as Array<keyof CpCustomization>;
  for (const key of keys) {
    await handleCpCustomization(config, key);
  }
}
export async function handleCpCustomization(config?: CpCustomization, key?: string) {
  if (!config || !key) {
    return;
  }
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
    return;
  }
}

export function getSpawnConfigByScriptName<CpConfig = any>(
  basename: ScriptFileName,
  config?: SpawnTsScriptConfig<CpConfig>
): SpawnAndTryIpcConfig<CpConfig> {
  const {args = [], spawnOptions, waitFirstIpc, infoToCp} = config ?? {};
  const scriptPath = getScriptFullpath(basename);
  const suffix = basename.split('.').pop().toLowerCase();
  let command = '';
  let params: string[] = [];
  if (suffix === 'ts') {
    command = 'ts-node';
    params = [...params, ...getTsParams(scriptPath), ...args];
  } else if (suffix === 'js') {
    command = 'node';
    params = [scriptPath, ...args];
  }
  return {
    command,
    args: params,
    spawnOptions,
    infoToCp,
    waitFirstIpc,
  };
}

export async function spawnScript<CpConfig = any, ResponseFromCp = any>(
  basename: ScriptFileName,
  config?: SpawnTsScriptConfig<CpConfig>
): Promise<SpawnAndTryIpcResponse<ResponseFromCp> & SpawnConfig> {
  const spawnConfig = getSpawnConfigByScriptName(basename, config);
  const {childProcess, responseFromCp} = await spawnAndTryIpc(spawnConfig);
  const info = {
    ...spawnConfig,
    childProcess,
    responseFromCp,
  };
  return info;
}
