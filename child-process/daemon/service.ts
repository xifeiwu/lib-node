import {Daemon} from '../../types';
import {getCpConfigByScriptName} from '../run-on-cp';
import {getCpConfigByScriptPath, serializeSpawnResponse, spawnAndTryIpc} from '../spawn';

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
  const spawnConfig4Daemon = getCpConfigByScriptName<Daemon.DaemonConfig>('daemon.ts', {
    /** args key is used for killing Zombie Daemon Process */
    params: [daemonKey],
    infoToCp: {
      config: daemonConfig,
    },
    maxWaitTime4Ipc: debug ? MAX_WAIT_TIME_DEBUG_MODE : 20,
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

/**
 * Used to get Daemon's cpConfig for a .ts script
 * @param fullPath
 * @param options
 * @returns
 */
// export function getDaemonCpConfigByScriptPath<CpConfig = any>(
//   fullPath: string,
//   options?: Partial<Daemon.CpManagerConfig>
// ): Daemon.CpManagerConfig {
//   const {id, retry, ...restOptions} = options ?? {};
//   const spawnConfig = getCpConfigByScriptPath<CpConfig>(fullPath, restOptions);
//   return {
//     id,
//     retry,
//     ...spawnConfig,
//   };
// }
