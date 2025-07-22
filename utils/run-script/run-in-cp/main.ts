import path from 'path';
import {RunScriptInCPOptions, TsNodeOptions} from '../../../types';
import {getFilePathInfo} from '../../../path';
import {
  getSpawnConfigByScript,
  serializeSpawnResponse,
  spawnAndTryIpc,
  tryUseJsFile,
} from '../../../child-process';
import {logColorful} from '../../../log';
/** make sure ./child.ts is compiled to child.js also */
import './child';

const defaultTsNodeOptions: TsNodeOptions = {
  // '--transpileOnly': true,
  '--swc': true,
  '-r': null,
  '--project': null,
};

/**
 * Get ts-node options by targetScript
 * Run cp
 */
export async function runTsScriptInCP(targetScript: string, options?: RunScriptInCPOptions) {
  const {
    dryRun,
    spawnOptions: {env = {}, ...restSpawnOptions} = {},
    tsNodeOptions,
    runScriptOptions,
  } = options ?? {};

  const {extname} = getFilePathInfo(targetScript);
  if (!['.ts', '.js'].includes(extname)) {
    throw new Error(`Can only run .ts or .js script`);
  }
  const mainScript = tryUseJsFile(path.join(__dirname, 'child.ts'));
  const targetIsTsFile = extname === '.ts';

  /**
   * get command and args by targetScript:
   * command: ts-node
   * args: [-r, node/start/feature/node_modules/tsconfig-paths/register.js, --project, node/start/feature/tsconfig.json, --swc, /Users/wuxifei/code/node/start/feature/1-js/object/defineProperty/get-set.ts]
   */
  const spawnAndIpcConfig = getSpawnConfigByScript<TsNodeOptions>(targetScript, {
    runtimeOptions: targetIsTsFile ? tsNodeOptions ?? defaultTsNodeOptions : {},
  });
  const {command, args} = spawnAndIpcConfig;

  /**
   * targetScript     mainScript        runtime
   * .ts              .ts               ts-node
   * .ts              .js               ts-node
   * .js              .ts               ts-node
   * .js              .js               node
   */
  const finalCommand = getFilePathInfo(mainScript).extname === '.ts' ? 'ts-node' : command;
  const finalArgs = [...args];
  finalArgs.splice(args.length - 1, 0, mainScript);

  const wholeScript = [
    finalCommand,
    ...finalArgs,
    runScriptOptions?.funcName,
    ...(runScriptOptions?.funcParams ?? []),
  ]
    .filter(Boolean)
    .join(' ');
  logColorful({color: 'magenta'}, wholeScript);
  if (dryRun) {
    return;
  }

  process.stdin.setRawMode(false);
  const response = await spawnAndTryIpc({
    command: finalCommand,
    args: finalArgs,
    spawnOptions: {
      ...restSpawnOptions,
      stdio: [0, 1, 2, 'ipc'],
      env: {
        ...process.env,
        ...env,
        SPAWNED_BY: __filename,
      },
    },
    infoToCp: {
      config: [targetScript, runScriptOptions],
    },
    maxWaitTime4Ipc: 30,
  });
  const {childProcess} = response;
  logColorful({color: 'magenta'}, `pid of main/child process: ${process.pid}/${childProcess.pid}`);

  childProcess.on('exit', () => {
    // console.log('exit child process');
    process.stdin.setRawMode(true);
    // process.stdin.unpipe(childProcess.stdin);
    // process.stdin.off('data', )
  });
  return serializeSpawnResponse(response);
}
