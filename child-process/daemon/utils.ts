import {CP, SpawnAndTryIpcConfig} from '../../types';
import {getSpawnConfigByScriptName} from '../run-on-cp';
import {socketDir, socketFileSuffix} from './service';
import {serializeSpawnResponse, spawnAndTryIpc} from '../spawn';

export interface DetachedDaemonConfig extends Omit<CP.DaemonConfig, 'socketPath'> {
  /** For socket server: fullname or object of path info */
  daemonKey: string;
}

export async function startDetachedDaemon(
  daemonConfig: DetachedDaemonConfig,
  cpSpawnConfig: SpawnAndTryIpcConfig
) {
  const {daemonKey, ...restDaemonConfig} = daemonConfig;
  const spawnConfig4Daemon = getSpawnConfigByScriptName<CP.DaemonConfig>('daemon.ts', {
    /** args key is used for killing Zombie Daemon Process */
    args: ['startDetachedDaemon'],
    infoToCp: {
      config: {
        socketPath: {
          dirname: socketDir,
          basename: daemonKey + socketFileSuffix,
        },
        ...restDaemonConfig,
      },
      spawnConfig: cpSpawnConfig,
    },
    maxWaitTime4Ipc: 20,
    spawnOptions: {stdio: ['ignore', 'ignore', 'ignore', 'ipc']},
  });
  const spawnResponse = await spawnAndTryIpc<CP.DaemonConfig, CP.DaemonResponseOnAction>(spawnConfig4Daemon);
  const {childProcess, responseFromCp} = spawnResponse;
  if (responseFromCp.type === 'error') {
    console.log(responseFromCp.message);
  } else {
    childProcess.disconnect();
    childProcess.unref();
  }
  // console.log(`typeof responseFromCp`);
  // console.log(typeof responseFromCp);
  // console.log(responseFromCp instanceof Error);
  return serializeSpawnResponse(spawnResponse);
}
