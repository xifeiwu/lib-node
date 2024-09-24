import path from 'path';
import {CP, InfoToCp, SpawnAndTryIpcConfig} from '../../types';
import {getSpawnConfigByScriptName} from '../run-on-cp';
import {socketDir, socketFileSuffix} from './service';
import {spawnAndTryIpc} from '../spwan';

export interface DetachedDaemonConfig extends Omit<CP.DaemonConfig, 'socketPath'> {
  /** For socket server: fullname or object of path info */
  daemonKey: string;
}

export async function startDetachedDaemon(
  daemonConfig: DetachedDaemonConfig,
  spawnCpConfig: SpawnAndTryIpcConfig
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
      spawnConfig: spawnCpConfig,
    },
    spawnOptions: {stdio: ['ipc']},
  });
  const spawnResponse = await spawnAndTryIpc(spawnConfig4Daemon);
  const {childProcess, responseFromCp} = spawnResponse;
  childProcess.disconnect();
  childProcess.unref();
  return spawnResponse;
}
