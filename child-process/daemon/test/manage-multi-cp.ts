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
export async function getDaemonInfo() {
  const response = await socketClient.info(daemonKey);
  logColorful({}, response);
}
export async function startDebugServer1() {
  const response = await socketClient.start(debugServer1Id);
  logColorful({}, response);
}
export async function getDebugServer1Info() {
  const response = await socketClient.info(debugServer1Id);
  logColorful({}, response);
}
export async function stopDebugServer1() {
  const response = await socketClient.stop(debugServer1Id);
  logColorful({}, response);
}

export async function startDebugServer2() {
  const response = await socketClient.start(spawnDebugServer2);
  logColorful({}, response);
}
export async function getDebugServer2Info() {
  const response = await socketClient.info(spawnDebugServer2.id);
  logColorful({}, response);
}
export async function stopDebugServer2() {
  const response = await socketClient.stop(spawnDebugServer2.id);
  logColorful({}, response);
}

export async function stopDaemon() {
  const response = await socketClient.stop(daemonKey);
  logColorful({}, response);
}
