import path from 'path';
import {NodeCpWrapScriptOptions, RunScriptInCpOptions} from '../types';
import {SpawnConfig, TsNodeOptions} from '../../../types';
import {getFilePathInfo, getPreferredFileByExt} from '../../../path';
import {getCommandByScriptPath} from '../../../child-process';
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
export function getSpawnConfigForCpScript(
  targetScript: string,
  options: RunScriptInCpOptions<TsNodeOptions, NodeCpWrapScriptOptions>
) {
  const {
    runtimeOptions = {},
    params,
    cpWrapperOptions,
    spawnOptions: {env = {}, ...restSpawnOptions} = {},
    minUptime,
  } = options ?? {};
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

  // Insert wrapScript before the target path (always the last element of args)
  const finalArgs = [...args];
  finalArgs.splice(args.length - 1, 0, wrapScript);

  // If wrapScript is .ts and runtime is not tsx, override to ts-node
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
    maxWaitTime4Ipc: 30,
    minUptime,
  };
  return {wholeScript, spawnConfig};
}
