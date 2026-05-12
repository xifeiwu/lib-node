import {SpawnScriptOptions} from '../../types';
import {getSpawnConfigByScript, serializeSpawnResponse, spawnAndTryIpc} from '../../child-process';
import {logColorful} from '../../log';
import {getSpawnConfigForCpScript} from './on-node';

function setRawModeIfPossible(value: boolean): void {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(value);
  }
}

export async function runScriptInCP<InfoToCp = any, InfoToCpWrapper = any>(
  targetScript: string,
  options?: {
    dryRun?: boolean;
    spawnOptions?: SpawnScriptOptions<any, InfoToCp>;
    spawnWrapperOptions?: SpawnScriptOptions<any, InfoToCpWrapper>;
  }
) {
  const {dryRun, spawnOptions, spawnWrapperOptions} = options ?? {};

  let wholeScript: string;
  let spawnConfig;

  if (spawnWrapperOptions) {
    const result = getSpawnConfigForCpScript(targetScript, spawnWrapperOptions, spawnOptions?.params);
    wholeScript = result.wholeScript;
    spawnConfig = result.spawnConfig;
  } else {
    const config = getSpawnConfigByScript(targetScript, spawnOptions);
    const {command, args = []} = config;
    wholeScript = [command, ...args].join(' ');
    spawnConfig = {
      ...config,
      spawnOptions: {
        stdio: [0, 1, 2] as any,
        ...config.spawnOptions,
      },
    };
  }

  logColorful({color: 'magenta'}, 'Whole script to run in child process:', wholeScript);
  if (dryRun) {
    return;
  }
  setRawModeIfPossible(false);
  const response = await spawnAndTryIpc(spawnConfig);
  const {childProcess} = response;

  childProcess.on('exit', () => {
    setRawModeIfPossible(true);
  });
  return serializeSpawnResponse(response);
}
