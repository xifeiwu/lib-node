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
import {CP} from '../../types';
import {getTsParams, SpawnAndTryIpcResponse} from '../../index';

/** For child process */
export function out(value: any) {
  toConsole(value);
  if (process.connected && process.send) {
    /** Child process will exit by the error EPipe if the error is not catched here */
    process.send(value, err => {
      console.log(`err`);
      console.log(err);
    });
  }
}

export function getScriptFullpath(basename: CP.ScriptFileName) {
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

export async function runAllCpCustomization(config?: CP.CpCustomization) {
  config = config ?? {};
  const keys = Object.keys(config) as Array<keyof CP.CpCustomization>;
  for (const key of keys) {
    await handleCpCustomization(config, key);
  }
}
export async function handleCpCustomization(config?: CP.CpCustomization, key?: string) {
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

/**
 * Get SpawnConfig by basename of script, and merged with param config.
 * @param basename
 * @param config
 * @returns
 */
export function getSpawnConfigByScriptName<CpConfig = any>(
  basename: CP.ScriptFileName,
  config?: CP.SpawnTsScriptConfig<CpConfig>
): SpawnAndTryIpcConfig<CpConfig> {
  const {args = [], ...restConfig} = config ?? {};
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
    ...restConfig,
  };
}

export async function spawnScript<CpConfig = any, ResponseFromCp = any>(
  basename: CP.ScriptFileName,
  config?: CP.SpawnTsScriptConfig<CpConfig>
): Promise<SpawnAndTryIpcResponse<ResponseFromCp> & {config: SpawnConfig}> {
  const spawnConfig = getSpawnConfigByScriptName(basename, config);
  const cpInfo = await spawnAndTryIpc(spawnConfig);
  return {
    config: spawnConfig,
    ...cpInfo,
  };
}
