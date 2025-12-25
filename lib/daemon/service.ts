import path from 'path';
import {
  getSpawnConfigByScript,
  serializeSpawnResponse,
  spawnAndTryIpc,
  tryUseJsFile,
} from './external';
import {
  DaemonConfig,
  DaemonResponse,
} from './types';

const MAX_WAIT_TIME_DEBUG_MODE = 120;
export async function startDetachedDaemon(
  daemonConfig: DaemonConfig,
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
      spawnConfig.maxWaitCpResInSec = MAX_WAIT_TIME_DEBUG_MODE;
    }
  }
  const scriptPath = tryUseJsFile(path.resolve(__dirname, './cp-script/daemon.ts'));
  const spawnConfig4Daemon = getSpawnConfigByScript<DaemonConfig>(scriptPath, {
    /** args key is used for killing Zombie Daemon Process */
    params: [daemonKey],
    infoToCp: daemonConfig,
    maxWaitTime4Ipc: MAX_WAIT_TIME_DEBUG_MODE,
    spawnOptions: {stdio: debug ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc']},
  });
  const spawnResponse = await spawnAndTryIpc<DaemonConfig, DaemonResponse>(spawnConfig4Daemon);
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

