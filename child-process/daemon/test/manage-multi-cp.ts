import {getScriptFullpath} from '../../cp-script';
import {logColorful, CP, getSocketPath, Daemon, getCpConfigByScriptPath} from '../../../index';
import {startDetachedDaemon} from '../service';
import {SocketClientToDaemon} from '../client';

// const debugMode = true;
// const stdio: SpawnOptions['stdio'] = debugMode ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc'];

const debugServer1Id = 'debug-server-1';
const spawnDebugServer1: Daemon.CpManagerConfig = {
  id: debugServer1Id,
  managerConfig: {
    retry: {
      maxCount: 3,
      minInterval: 5000,
    },
  },
  spawnConfig: getCpConfigByScriptPath<CP.DebugServerConfig>(getScriptFullpath('debug-server.ts'), {
    // spawnOptions: {
    //   stdio,
    // },
    maxWaitTime4Ipc: 20,
  }),
};

const debugServer2Id = 'debug-server-2';
const spawnDebugServer2: Daemon.CpManagerConfig = {
  id: debugServer2Id,
  // managerConfig: {
  //   retry: {
  //     maxCount: 3,
  //     minInterval: 5000,
  //   },
  // },
  spawnConfig: getCpConfigByScriptPath<CP.DebugServerConfig>(getScriptFullpath('debug-server.ts'), {
    // spawnOptions: {
    //   stdio,
    // },
    maxWaitTime4Ipc: 20,
  }),
};

const daemonKey = 'testStartDetachedDaemon';
const socketPath = getSocketPath(daemonKey);
const socketClient = new SocketClientToDaemon({path: socketPath});

export async function runDetachedDaemon() {
  const spawnResponse = await startDetachedDaemon(
    {
      id: daemonKey,
      cpManagerConfigList: [spawnDebugServer1],
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
