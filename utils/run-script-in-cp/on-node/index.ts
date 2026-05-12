import path from 'path';
import {NodeCpWrapScriptOptions} from '../types';
import {SpawnConfig, SpawnScriptOptions, TsNodeOptions} from '../../../types';
import {getFilePathInfo, getPreferredFileByExt} from '../../../path';
import {getCommandByScriptPath} from '../../../child-process';
import type {CpWrapScriptIpcMessage} from './types';

const defaultTsNodeOptions: TsNodeOptions = {
  // '--transpileOnly': true,
  '--swc': true,
  '-r': null,
  '--project': null,
};

export function getSpawnConfigForCpScript(
  targetScript: string,
  spawnWrapperOptions: SpawnScriptOptions<TsNodeOptions, NodeCpWrapScriptOptions>,
  params?: string[]
) {
  const {
    runtimeOptions = {},
    infoToCp: cpWrapperOptions,
    spawnOptions: {env = {}, ...restSpawnOptions} = {},
    minUptime,
    maxWaitTime4Ipc = 30,
    maxWaitCpResInSec,
  } = spawnWrapperOptions ?? {};
  const {runTargetScriptOptions} = cpWrapperOptions ?? {};

  const {extname} = getFilePathInfo(targetScript);
  if (!['.ts', '.js'].includes(extname)) {
    throw new Error(`Currently, we only support to run .ts or .js script, but got ${extname}`);
  }

  const wrapScript = getPreferredFileByExt(path.join(__dirname, 'cp-wrapper-script.ts'), {
    preferredExtSequence: ['.js'],
  });

  const {command, args} = getCommandByScriptPath<TsNodeOptions>(targetScript, {
    runtimeOptions: extname === '.ts' ? {...defaultTsNodeOptions, ...runtimeOptions} : {},
    params,
  });

  const finalArgs = [...args];
  finalArgs.splice(args.length - 1, 0, wrapScript);

  const wrapScriptIsTsFile = getFilePathInfo(wrapScript).extname === '.ts';
  const finalCommand = command !== 'tsx' && wrapScriptIsTsFile ? 'ts-node' : command;

  const wholeScript = [
    finalCommand,
    ...finalArgs,
    runTargetScriptOptions?.funcName,
    ...(runTargetScriptOptions?.funcParams ?? []),
  ]
    .filter(Boolean)
    .join(' ');

  const spawnConfig: SpawnConfig = {
    command: finalCommand,
    args: finalArgs,
    spawnOptions: {
      stdio: [0, 1, 2, 'ipc'],
      ...restSpawnOptions,
      env: {...process.env, ...env},
    },
    infoToCp: {...cpWrapperOptions, targetScript} as CpWrapScriptIpcMessage,
    maxWaitTime4Ipc,
    maxWaitCpResInSec,
    minUptime,
  };
  return {wholeScript, spawnConfig};
}
