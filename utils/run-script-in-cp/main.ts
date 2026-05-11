import {RunScriptInCpOptions} from './types';
import {serializeSpawnResponse, spawnAndTryIpc} from '../../child-process';
import {logColorful} from '../../log';
import {getSpawnConfigForCpScript} from './on-node';

function setRawModeIfPossible(value: boolean): void {
  if (process.stdin.isTTY && process.stdin.setRawMode) {
    process.stdin.setRawMode(value);
  }
}

/**
 * Run target script in child process
 * the final target is to support run target script on any runtime, like ts-node, tsx, python, etc.
 * the script should can be run on any runtime, like ts-node, tsx, python, etc.
 * - In order to run target script on any runtime, we need to get the runtime options by targetScript.
 * - In order to select the exported function from target script, which is very useful for debug script,
 * we didn't spawn the script directly, but spawn a cp-wrapper-script.ts to run the target script.
 */
export async function runScriptInCP(
  targetScript: string,
  options: RunScriptInCpOptions,
  moreOptions?: {
    dryRun?: boolean;
  }
) {
  const {dryRun} = moreOptions ?? {};
  const {wholeScript, spawnConfig} = getSpawnConfigForCpScript(targetScript, options);
  logColorful({color: 'magenta'}, 'Whole script to run in child process:', wholeScript);
  if (dryRun) {
    return;
  }
  setRawModeIfPossible(false);
  const response = await spawnAndTryIpc(spawnConfig);
  const {childProcess} = response;
  // logColorful({color: 'magenta'}, `pid of main/child process: ${process.pid}/${childProcess.pid}`);

  childProcess.on('exit', () => {
    // console.log('exit child process');
    setRawModeIfPossible(true);
    // process.stdin.unpipe(childProcess.stdin);
    // process.stdin.off('data', )
  });
  return serializeSpawnResponse(response);
}
