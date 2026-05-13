import path from 'path';
import {NodeCpWrapScriptOptions} from '../types';
import {SpawnConfig, SpawnScriptOptions, TsNodeOptions} from '../../../types';
import {getFilePathInfo, getPreferredFileByExt} from '../../../path';
import {getCommandAndArgsByScriptPath} from '../../../child-process';

const defaultTsNodeOptions: TsNodeOptions = {
  // '--transpileOnly': true,
  '--swc': true,
  '-r': null,
  '--project': null,
};

export function getSpawnConfigForRunExport<
  InfoToCpWrapper extends NodeCpWrapScriptOptions = NodeCpWrapScriptOptions,
>(targetScript: string, spawnWrapperOptions: SpawnScriptOptions<TsNodeOptions, InfoToCpWrapper>) {
  const {runtimeOptions = {}, params, spawnOptions = {}, ...rest} = spawnWrapperOptions ?? {};

  const {extname} = getFilePathInfo(targetScript);
  if (!['.ts', '.js'].includes(extname)) {
    throw new Error(`Currently, we only support to run .ts or .js script, but got ${extname}`);
  }

  const wrapScript = getPreferredFileByExt(path.join(__dirname, 'cp-wrapper-script.ts'), {
    preferredExtSequence: ['.js'],
  });

  const {command, args} = getCommandAndArgsByScriptPath<TsNodeOptions>(targetScript, {
    runtimeOptions: extname === '.ts' ? {...defaultTsNodeOptions, ...runtimeOptions} : {},
    params,
  });

  /**
   * Format of args:
   * [
   *   '-r',
   *   '/Users/wuxifei/code/node/tool/busybox/node_modules/tsconfig-paths/register.js',
   *   '--project',
   *   '/Users/wuxifei/code/node/tool/busybox/tsconfig.json',
   *   '--swc',
   *   '/Users/wuxifei/code/node/tool/busybox/src/run-in-cp/test/project/index.ts',
   *   'add1',
   *   '10',
   * ]
   */
  const finalArgs = [...args];
  finalArgs.splice(args.length - (1 + (params?.length ?? 0)), 0, wrapScript);

  const wrapScriptIsTsFile = getFilePathInfo(wrapScript).extname === '.ts';
  const finalCommand = command !== 'tsx' && wrapScriptIsTsFile ? 'ts-node' : command;

  spawnOptions.stdio = [0, 1, 2, 'ipc'];
  if (spawnOptions.env) {
    spawnOptions.env = {...process.env, ...spawnOptions.env};
  }

  const spawnConfig: SpawnConfig = {
    ...rest,
    command: finalCommand,
    args: finalArgs,
    spawnOptions,
  };
  return spawnConfig;
}
