import {DaemonConfig, DaemonInfo, CommandCommon, LaunchCpConfig} from '../types';
import {logColorful, oneChatFromSocketClient, spawnAndTryIpc, getSpawnAndIpcConfigByScript, CP} from '../external';

/**
 * Make sure daemon process is through
 */
export async function runEmptyDaemon() {
  const daemonKey = 'runEmptyDaemon';
  const spawnConfig4Daemon = getSpawnAndIpcConfigByScript<DaemonConfig>(require('path').resolve(__dirname, './entry.ts'), {
    params: ['runEmptyDaemon'],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {
      config: {
        id: daemonKey,
      },
    },
    maxWaitTime4Ipc: 60,
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<DaemonConfig, DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
  const socketPath = responseFromCp.status.connection.socket.path;
  const infoCommand: CommandCommon = {action: 'info'};
  const socketResponse = await oneChatFromSocketClient(infoCommand, {path: socketPath});
  logColorful({}, socketResponse);
}

/**
 * Make sure handle cp in daemon process is through
 */
export async function daemonDebugServer() {
  const daemonKey = 'daemonDebugServer';
  const spawnConfigDebugServer = getSpawnAndIpcConfigByScript<CP.DebugServerConfig>('debug-server.ts', {
    params: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 600,
  });
  const cpConfig4DebugServer: LaunchCpConfig = {
    ...spawnConfigDebugServer,
    id: daemonKey,
  };
  const spawnConfig4Daemon = getSpawnAndIpcConfigByScript<DaemonConfig>(require('path').resolve(__dirname, './entry.ts'), {
    params: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {
      config: {
        id: daemonKey,
        cpWrapperConfigList: [cpConfig4DebugServer],
      },
    },
    maxWaitTime4Ipc: 600,
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<DaemonConfig, DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
}

export async function daemon2DebugServer() {
  const daemonKey = 'daemon2DebugServer';
  const spawnConfig = getSpawnAndIpcConfigByScript<CP.DebugServerConfig>('debug-server.ts', {
    params: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 600,
  });
  const spawnConfig2 = getSpawnAndIpcConfigByScript<CP.DebugServerConfig>('debug-server.ts', {
    params: [daemonKey],
    spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 600,
  });
  const spawnConfig4Daemon = getSpawnAndIpcConfigByScript<DaemonConfig>(require('path').resolve(__dirname, './entry.ts'), {
    params: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {
      config: {
        id: daemonKey,
        cpWrapperConfigList: [
          {...spawnConfig, id: 'debug-server-1'},
          {...spawnConfig2, id: 'debug-server-2'},
        ],
      },
    },
    maxWaitTime4Ipc: 600,
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<DaemonConfig, DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
}
