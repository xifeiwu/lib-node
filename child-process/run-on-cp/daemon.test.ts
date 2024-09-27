import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {CP, Daemon} from '../../types';
import {
  fromBuffer,
  getSpawnConfigByScriptName,
  logColorful,
  oneChatFromSocketClient,
  spawnAndTryIpc,
} from '../../index';
import {SOCKET_FILE_SUFFIX} from '../../constants';

export async function runEmptyDaemon() {
  const daemonKey = 'runEmptyDaemon';
  const spawnConfig4Daemon = getSpawnConfigByScriptName<Daemon.DaemonConfig>('daemon.ts', {
    args: ['runEmptyDaemon'],
    spawnOptions: {stdio: [0, 1, 2, 'ipc']},
    infoToCp: {
      config: {
        daemonKey: 'runEmptyDaemon',
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

export async function daemonDebugServer() {
  const spawnConfigDebugServer = getSpawnConfigByScriptName('debug-server.ts', {
    infoToCp: {},
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
      spawnConfig: spawnConfigDebugServer,
    },
    spawnOptions: {stdio: ['ipc']},
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<CP.DaemonConfig, CP.DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
}
