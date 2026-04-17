import path from 'path';
import {
  getSpawnConfigByScript,
  serializeSpawnResponse,
  spawnAndTryIpc,
  tryUseJsFile,
} from '../../service/external';
import {SocketConfig, DaemonResponse} from '../../service';
import {MAX_WAIT_TIME_DEBUG_MODE} from '../../service';

export async function startDetachedDaemon(socketConfig: SocketConfig, featureConfig?: {debug?: boolean}) {
  const {daemonConfig} = socketConfig;
  const {launchCpConfigList} = daemonConfig;
  const {debug = false} = featureConfig ?? {};
  if (debug) {
    for (const entry of launchCpConfigList) {
      const {spawnConfig} = entry?.cpConfig ?? {};
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
  const scriptPath = tryUseJsFile(path.resolve(__dirname, './script.ts'));
  const spawnConfig4Daemon = getSpawnConfigByScript<SocketConfig>(scriptPath, {
    /** args key is used for killing Zombie Daemon Process */
    params: [socketConfig.serverConfig.path ?? String(socketConfig.serverConfig.port)],
    infoToCp: socketConfig,
    maxWaitTime4Ipc: MAX_WAIT_TIME_DEBUG_MODE,
    spawnOptions: {stdio: debug ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc']},
  });
  const spawnResponse = await spawnAndTryIpc<SocketConfig, DaemonResponse>(spawnConfig4Daemon);
  const {childProcess, responseFromCp} = spawnResponse;
  if (responseFromCp.type === 'error') {
    console.log(responseFromCp.data);
  }
  if (childProcess && !debug) {
    childProcess.disconnect && childProcess.disconnect();
    childProcess.unref();
  }
  return serializeSpawnResponse(spawnResponse);
}
