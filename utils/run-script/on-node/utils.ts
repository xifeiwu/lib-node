import path from 'path';
import {CpWrapScriptOptions, RunScriptInCPOptions, SpawnConfig, TsNodeOptions} from '../../../types';
import {getFilePathInfo, getPreferredFileByExt} from '../../../path';
import {getSpawnConfigByScript, tryUseJsFile} from '../../../child-process';

const defaultTsNodeOptions: TsNodeOptions = {
  // '--transpileOnly': true,
  '--swc': true,
  '-r': null,
  '--project': null,
};

/**
 * Get spawn config for cp-wrap-script.ts
 */
export async function getSpawnConfigForCpWrapScript(options: RunScriptInCPOptions) {
  const {
    preScript,
    runtimeOptions = {},
    targetScript,
    runTargetScriptOptions,
    spawnOptions: {env = {}, ...restSpawnOptions} = {},
  } = options ?? {};

  const {extname} = getFilePathInfo(targetScript);
  if (!['.ts', '.js'].includes(extname)) {
    throw new Error(`Can only run .ts or .js script`);
  }
  const wrapScript = getPreferredFileByExt(path.join(__dirname, 'cp-wrap-script.ts'), {
    preferredExtSequence: ['.js'],
  });
  const targetIsTsFile = extname === '.ts';

  /**
   * get command and args for targetScript:
   * command: ts-node
   * args: [-r, node/start/feature/node_modules/tsconfig-paths/register.js, --project, node/start/feature/tsconfig.json, --swc, /Users/wuxifei/code/node/start/feature/1-js/object/defineProperty/get-set.ts]
   */
  const spawnAndIpcConfig = getSpawnConfigByScript<TsNodeOptions>(targetScript, {
    runtimeOptions: targetIsTsFile ? {...defaultTsNodeOptions, ...runtimeOptions} : {},
  });
  const {command, args} = spawnAndIpcConfig;

  /**
   * targetScript     mainScript        runtime
   * .ts              .ts               ts-node
   * .ts              .js               ts-node
   * .js              .ts               ts-node
   * .js              .js               node
   */
  const finalCommand = getFilePathInfo(wrapScript).extname === '.ts' ? 'ts-node' : command;
  const finalArgs = [...args];
  finalArgs.splice(args.length - 1, 0, wrapScript);

  const wholeScript = [
    finalCommand,
    ...finalArgs,
    runTargetScriptOptions?.funcName,
    ...(runTargetScriptOptions?.funcParams ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  const infoToCp: CpWrapScriptOptions = {
    preScript,
    targetScript,
    runTargetScriptOptions,
  };
  const spwanConfig: SpawnConfig = {
    command: finalCommand,
    args: finalArgs,
    spawnOptions: {
      stdio: [0, 1, 2, 'ipc'],
      ...restSpawnOptions,
      env: {
        ...process.env,
        ...env,
        // SPAWNED_BY: __filename,
      },
    },
    infoToCp,
    maxWaitTime4Ipc: 30,
  };
  return {wholeScript, spwanConfig};
}
