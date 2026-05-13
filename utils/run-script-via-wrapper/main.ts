import {SpawnScriptOptions} from '../../types';
import {getSpawnConfigByScript, serializeSpawnResponse, spawnAndTryIpc} from '../../child-process';
import {logColorful} from '../../log';
import {getSpawnConfigForRunExport} from './run-export';

export async function getCustomizedSpawnConfig<InfoToCp = any, InfoToCpWrapper = any>(
  targetScript: string,
  options?: {
    spawnOptions?: SpawnScriptOptions<any, InfoToCp>;
    spawnWrapperOptions?: SpawnScriptOptions<any, InfoToCpWrapper>;
  }
) {
  const {spawnOptions, spawnWrapperOptions} = options ?? {};

  // let wholeScript: string;
  let spawnConfig;

  if (spawnWrapperOptions) {
    spawnConfig = getSpawnConfigForRunExport(targetScript, spawnWrapperOptions);
    // wholeScript = result.wholeScript;
  } else {
    const config = getSpawnConfigByScript(targetScript, spawnOptions);
    const {command, args = []} = config;
    // wholeScript = [command, ...args].join(' ');
    spawnConfig = {
      ...config,
      spawnOptions: {
        stdio: [0, 1, 2] as any,
        ...config.spawnOptions,
      },
    };
  }
  return spawnConfig;
}

export async function runScriptInCP<InfoToCp = any, InfoToCpWrapper = any>(
  targetScript: string,
  options?: {
    dryRun?: boolean;
    spawnOptions?: SpawnScriptOptions<any, InfoToCp>;
    spawnWrapperOptions?: SpawnScriptOptions<any, InfoToCpWrapper>;
  }
) {
  const {dryRun} = options ?? {};
  const spawnConfig = await getCustomizedSpawnConfig(targetScript, options);
  if (dryRun) {
    return;
  }
  const response = await spawnAndTryIpc(spawnConfig, {stdinRawMode: true});
  return serializeSpawnResponse(response);
}
