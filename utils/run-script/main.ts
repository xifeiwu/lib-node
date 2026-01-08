import {RunScriptInCPOptions} from '../../types';
import {serializeSpawnResponse, spawnAndTryIpc} from '../../child-process';
import {logColorful} from '../../log';
import {getSpawnConfigForCpWrapScript} from './on-node/utils';

/**
 * Run target script in child process, the script should can be run on any runtime, like ts-node, python, etc.
 * In order to run target script on any runtime, we need to get the runtime options by targetScript.
 * In order to select the exported function from target script, which is very useful for debug script,
 * we didn't spawn the script directly, but spawn a cp-script.ts to run the target script.
 */
export async function runScriptInCP(options: RunScriptInCPOptions) {
  const {dryRun} = options ?? {};
  const {wholeScript, spwanConfig} = await getSpawnConfigForCpWrapScript(options);
  logColorful({color: 'magenta'}, wholeScript);
  if (dryRun) {
    return;
  }
  process.stdin.setRawMode(false);
  const response = await spawnAndTryIpc(spwanConfig);
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
