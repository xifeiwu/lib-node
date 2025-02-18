import path from 'path';
import {Daemon} from '../../types';
import {getCpConfigByScriptPath, serializeSpawnResponse, spawnAndTryIpc} from '../spawn';
import {tryUseJsFile} from '../service';

const MAX_WAIT_TIME_DEBUG_MODE = 120;
export async function startDetachedDaemon(
  daemonConfig: Daemon.DaemonConfig,
  featureConfig?: {debug?: boolean}
) {
  const {id: daemonKey, cpManagerConfigList} = daemonConfig;
  const {debug = false} = featureConfig ?? {};
  if (debug) {
    for (const cpManagerConfig of cpManagerConfigList) {
      const {spawnConfig} = cpManagerConfig ?? {};
      if (!spawnConfig) {
        continue;
      }
      if (!spawnConfig.spawnOptions) {
        spawnConfig.spawnOptions = {};
      }
      spawnConfig.spawnOptions.stdio = [0, 1, 2, 'ipc'];
      spawnConfig.maxWaitTime4Ipc = MAX_WAIT_TIME_DEBUG_MODE;
    }
  }
  const scriptPath = tryUseJsFile(path.resolve(__dirname, '../run-on-cp/daemon.ts'));
  const spawnConfig4Daemon = getCpConfigByScriptPath<Daemon.DaemonConfig>(scriptPath, {
    /** args key is used for killing Zombie Daemon Process */
    params: [daemonKey],
    infoToCp: {
      config: daemonConfig,
    },
    maxWaitTime4Ipc: MAX_WAIT_TIME_DEBUG_MODE,
    spawnOptions: {stdio: debug ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc']},
  });
  const spawnResponse = await spawnAndTryIpc<Daemon.DaemonConfig, Daemon.DaemonResponse>(spawnConfig4Daemon);
  const {childProcess, responseFromCp} = spawnResponse;
  if (responseFromCp.type === 'error') {
    console.log(responseFromCp.data);
  }
  if (childProcess && !debug) {
    childProcess.disconnect && childProcess.disconnect();
    childProcess.unref();
  }
  // console.log(`typeof responseFromCp`);
  // console.log(typeof responseFromCp);
  // console.log(responseFromCp instanceof Error);
  return serializeSpawnResponse(spawnResponse);
}
