import path from 'path';
import {RunScriptInCpOptions} from '../types';
import {SpawnConfig, TsNodeOptions} from '../../../types';
import {getFilePathInfo, getPreferredFileByExt} from '../../../path';
import {getSpawnConfigByScript} from '../../../child-process';
import type {CpWrapScriptIpcMessage} from './types';

const defaultTsNodeOptions: TsNodeOptions = {
  // '--transpileOnly': true,
  '--swc': true,
  '-r': null,
  '--project': null,
};

/**
 * Get spawn config for cp-wrapper-script.ts
 */
export async function getSpawnConfigForCpScript(targetScript: string, options: RunScriptInCpOptions) {
  const {
    runtimeOptions = {},
    cpWrapperOptions,
    spawnOptions: {env = {}, ...restSpawnOptions} = {},
  } = options ?? {};
  const {preScript, runTargetScriptOptions} = cpWrapperOptions ?? {};

  const {extname} = getFilePathInfo(targetScript);
  if (!['.ts', '.js'].includes(extname)) {
    throw new Error(`Currently, we only support to run .ts or .js script, but got ${extname}`);
  }
  // try use .js version first
  const wrapScript = getPreferredFileByExt(path.join(__dirname, 'cp-wrapper-script.ts'), {
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
  const targetIsEsm = command === 'tsx';

  /**
   * if wrapScript is a ts file, use ts-node to run it. even targetScript is a js file.
   */
  const finalCommand = targetIsEsm
    ? command
    : getFilePathInfo(wrapScript).extname === '.ts'
      ? 'ts-node'
      : command;
  const finalArgs = targetIsEsm ? [wrapScript, targetScript] : [...args];
  if (!targetIsEsm) {
    finalArgs.splice(args.length - 1, 0, wrapScript);
  }

  const wholeScript = [
    finalCommand,
    ...finalArgs,
    runTargetScriptOptions?.funcName,
    ...(runTargetScriptOptions?.funcParams ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  const infoToCp: CpWrapScriptIpcMessage = {
    ...cpWrapperOptions,
    targetScript,
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
