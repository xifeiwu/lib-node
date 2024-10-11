import {SpawnOptions} from 'child_process';
import {getScriptFullpath} from '../../run-on-cp';
import {logColorful, CP, getSocketPath} from '../../../index';
import {getDaemonCpConfigByScriptPath, startDetachedDaemon} from '../service';
import {SocketClient} from '../client';

const debugMode = true;
const stdio: SpawnOptions['stdio'] = debugMode ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc'];

const debugServer1Id = 'debug-server-1';
const spawnDebugServer1 = getDaemonCpConfigByScriptPath<CP.DebugServerConfig>(
  getScriptFullpath('debug-server.ts'),
  {
    spawnOptions: {
      stdio,
    },
    infoToCp: {},
    maxWaitTime4Ipc: 20,
    id: debugServer1Id,
    /** Test retry ability */
    retry: {
      maxCount: 3,
      minInterval: 5000,
    },
  }
);

const debugServer2Id = 'debug-server-2';
const spawnDebugServer2 = getDaemonCpConfigByScriptPath<CP.DebugServerConfig>(
  getScriptFullpath('debug-server.ts'),
  {
    spawnOptions: {
      stdio,
    },
    infoToCp: {},
    maxWaitTime4Ipc: 20,
    id: debugServer2Id,
  }
);

const daemonKey = 'testStartDetachedDaemon';
const socketPath = getSocketPath(daemonKey);
const socketClient = new SocketClient({path: socketPath});

export async function runDetachedDaemon() {
  const spawnResponse = await startDetachedDaemon(
    {
      id: daemonKey,
      cpConfigList: [spawnDebugServer1],
    },
    {debug: true}
  );
  logColorful({}, spawnResponse);
}

export async function ping() {
  const response = await socketClient.ping();
  logColorful({}, response);
}
export async function info() {
  const response = await socketClient.info(daemonKey);
  logColorful({}, response);
}
export async function server1Start() {
  const response = await socketClient.start(debugServer1Id);
  logColorful({}, response);
}
export async function server1Info() {
  const response = await socketClient.info(debugServer1Id);
  logColorful({}, response);
}
export async function server1Stop() {
  const response = await socketClient.stop(debugServer1Id);
  logColorful({}, response);
}
export async function server1Restart() {
  const response = await socketClient.restart(debugServer1Id);
  logColorful({}, response);
}

export async function server2Start() {
  const response = await socketClient.start(spawnDebugServer2);
  logColorful({}, response);
}
export async function server2Info() {
  const response = await socketClient.info(debugServer2Id);
  logColorful({}, response);
}
export async function server2Stop() {
  const response = await socketClient.stop(debugServer2Id);
  logColorful({}, response);
}
export async function server2Restart() {
  const response = await socketClient.restart(debugServer2Id);
  logColorful({}, response);
}

export async function stopDaemon() {
  const response = await socketClient.stop(daemonKey);
  logColorful({}, response);
}
