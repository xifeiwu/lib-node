import path from 'path';
import {
  getFileList,
  getCpConfigByScriptPath,
  spawnAndTryIpc,
  SpawnAndTryIpcConfig,
  SpawnConfig,
  toConsole,
  SpawnTsFileOptions,
} from '../../index';
import {isNumber, waitFor} from '../../external';
import {CP, IpcConfig} from '../../types';
import {SpawnAndTryIpcResponse} from '../../index';

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
export function getCpConfigByScriptName<CpConfig = any>(
  basename: CP.ScriptFileName,
  config?: SpawnTsFileOptions & IpcConfig<CpConfig>
): SpawnAndTryIpcConfig<CpConfig> {
  const scriptPath = getScriptFullpath(basename);
  return getCpConfigByScriptPath(scriptPath, config);
}
export async function spawnScript<CpConfig = any, ResponseFromCp = any>(
  basename: CP.ScriptFileName,
  config?: Partial<SpawnAndTryIpcConfig<CpConfig>>
): Promise<SpawnAndTryIpcResponse<ResponseFromCp> & {config: SpawnConfig}> {
  const spawnConfig = getCpConfigByScriptName(basename, config);
  const cpInfo = await spawnAndTryIpc(spawnConfig);
  return {
    config: spawnConfig,
    ...cpInfo,
  };
}
