import {CP, Daemon} from '../../types';
import {
  getAFreePort,
  getSpawnConfigByScriptName,
  logColorful,
  oneChatFromSocketClient,
  spawnAndTryIpc,
} from '../../index';
import {SOCKET_FILE_SUFFIX} from '../../constants';

/**
 * Make sure daemon process is through
 */
export async function runEmptyDaemon() {
  const daemonKey = 'runEmptyDaemon';
  const spawnConfig4Daemon = getSpawnConfigByScriptName<Daemon.DaemonConfig>('daemon.ts', {
    args: ['runEmptyDaemon'],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {
      config: {
        daemonKey,
      },
    },
    maxWaitTime4Ipc: 60,
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<Daemon.DaemonConfig, Daemon.DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
  const socketPath = responseFromCp.status.connection.socket.path;
  const infoCommand: Daemon.Command2Daemon = {action: 'info'};
  const socketResponse = await oneChatFromSocketClient(infoCommand, {path: socketPath});
  logColorful({}, socketResponse);
}

/**
 * Make sure handle cp in daemon process is through
 */
export async function daemonDebugServer() {
  const daemonKey = 'daemonDebugServer';
  const spawnConfigDebugServer = getSpawnConfigByScriptName<CP.DebugServerConfig>('debug-server.ts', {
    args: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 600,
  });
  const cpConfig4DebugServer: Daemon.CpConfig = {
    ...spawnConfigDebugServer,
    id: 'debug-server-1',
  };
  const spawnConfig4Daemon = getSpawnConfigByScriptName<Daemon.DaemonConfig>('daemon.ts', {
    args: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {
      config: {
        daemonKey,
        cp: cpConfig4DebugServer,
      },
    },
    maxWaitTime4Ipc: 600,
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<Daemon.DaemonConfig, Daemon.DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
}

export async function daemon2DebugServer() {
  const daemonKey = 'daemon2DebugServer';
  const spawnConfig = getSpawnConfigByScriptName<CP.DebugServerConfig>('debug-server.ts', {
    args: [daemonKey],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 600,
  });
  const spawnConfig2 = getSpawnConfigByScriptName<CP.DebugServerConfig>('debug-server.ts', {
    infoToCp: {
      config: {
        port: await getAFreePort(),
        delay: 5000,
        errorMessage: 'trigger Error by demend',
      },
    },
    args: ['daemonDebugServer'],
    spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
  });
  const spawnConfig4Daemon = getSpawnConfigByScriptName<CP.DaemonConfig>('daemon.ts', {
    args: ['daemonDebugServer'],
    infoToCp: {
      config: {
        retry: {
          maxCount: 10,
        },
      },
      spawnConfig: spawnConfig,
    },
    spawnOptions: {stdio: ['ipc']},
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<CP.DaemonConfig, CP.DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
}
