import {CP, SpawnAndTryIpcConfig} from '../../types';
import {getSpawnConfigByScriptName} from '../run-on-cp';
import {DAEMON_SOCKET_DIR, SOCKET_FILE_SUFFIX} from './service';
import {serializeSpawnResponse, spawnAndTryIpc} from '../spawn';

export interface DetachedDaemonConfig extends Omit<CP.DaemonConfig, 'socketPath'> {
  /** For socket server: fullname or object of path info */
  daemonKey: string;
}

export async function startDetachedDaemon(
  daemonConfig: DetachedDaemonConfig,
  cpSpawnConfig: SpawnAndTryIpcConfig,
  featureConfig?: {debug?: boolean}
) {
  const {daemonKey, ...restDaemonConfig} = daemonConfig;
  const {debug = false} = featureConfig ?? {};
  if (debug) {
    if (!cpSpawnConfig.spawnOptions) {
      cpSpawnConfig.spawnOptions = {};
    }
    cpSpawnConfig.spawnOptions.stdio = [0, 1, 2, 'ipc'];
  }
  const spawnConfig4Daemon = getSpawnConfigByScriptName<CP.DaemonConfig>('daemon.ts', {
    /** args key is used for killing Zombie Daemon Process */
    args: ['startDetachedDaemon'],
    infoToCp: {
      config: {
        socketPath: {
          dirname: DAEMON_SOCKET_DIR,
          basename: daemonKey + SOCKET_FILE_SUFFIX,
        },
        ...restDaemonConfig,
      },
      spawnConfig: cpSpawnConfig,
    },
    maxWaitTime4Ipc: debug ? 120 : 20,
    spawnOptions: {stdio: debug ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc']},
  });
  const spawnResponse = await spawnAndTryIpc<CP.DaemonConfig, CP.DaemonResponseOnAction>(spawnConfig4Daemon);
  const {childProcess, responseFromCp} = spawnResponse;
  if (responseFromCp.type === 'error') {
    console.log(responseFromCp.message);
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
