import path from 'path';
import {isNumber, waitFor} from '../../external';
import {CP, IpcConfig} from '../../types';
import {toConsole} from '../../log';
import {getFileList} from '../../fs';
import {parseBasename} from '../../path';
import {selectOption} from '../../readline';

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

export async function getFullPathOfCpScript(
  basename: string,
  options?: {
    tryJsFirst?: boolean;
  }
) {
  const {tryJsFirst} = options ?? {};
  const scriptList = await getFileList(__dirname, {
    fileFilter({basename}) {
      const {bareBasename, extname} = parseBasename(basename);
      return (
        ['.ts', '.js'].includes(extname) &&
        !bareBasename.endsWith('.test') &&
        !['service'].includes(bareBasename)
      );
    },
  });
  const bareBasenameList = scriptList.map(it => parseBasename(it).bareBasename);
  let target: string;
  if (bareBasenameList.includes(basename)) {
    basename += tryJsFirst ? '.js' : '.ts';
  }
  if (scriptList.includes(basename)) {
    target = basename;
  }
  if (!target) {
    ({label: target} = await selectOption(scriptList.map(it => ({label: it}))));
  }
  return path.resolve(__dirname, target);
}

// export async function runAllCpCustomization(config?: CP.CpCustomization) {
//   config = config ?? {};
//   const keys = Object.keys(config) as Array<keyof CP.CpCustomization>;
//   for (const key of keys) {
//     await handleCpCustomization(config, key);
//   }
// }
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
// export function getCpConfigByScriptName<CpConfig = any>(
//   basename: CP.ScriptFileName,
//   config?: SpawnFileOptions & IpcConfig<CpConfig>
// ): SpawnAndIpcConfig<CpConfig> {
//   const scriptPath = getScriptFullpath(basename);
//   return getCpConfigByScriptPath(scriptPath, config);
// }

// export async function spawnScriptAndTryIpc<CpConfig = any, ResponseFromCp = any>(
//   basename: CP.ScriptFileName,
//   config?: Partial<SpawnAndIpcConfig<CpConfig>>
// ): Promise<SpawnAndTryIpcResponse<ResponseFromCp> & {config: SpawnConfig}> {
//   const spawnConfig = getCpConfigByScriptName(basename, config);
//   const cpInfo = await spawnAndTryIpc(spawnConfig);
//   return {
//     config: spawnConfig,
//     ...cpInfo,
//   };
// }
