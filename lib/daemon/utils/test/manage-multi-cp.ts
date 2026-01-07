import fs from 'fs';
import path from 'path';
import {logColorful, CP, getSocketPath, getSpawnAndIpcConfigByScript} from '../../../../index';
import {startDetachedDaemon} from '../../utils/server';
import {SocketClientToDaemon} from '../../utils/client';
import {CpManagerConfig} from '../../types';

function getCpScript(basename: string) {
  const fullpath = path.join(__dirname, basename);
  if (!fs.existsSync(fullpath)) {
    throw new Error(`file not exist: ${fullpath}`);
  }
  return fullpath;
}
// const debugMode = true;
// const stdio: SpawnOptions['stdio'] = debugMode ? [0, 1, 2, 'ipc'] : ['ignore', 'ignore', 'ignore', 'ipc'];

const debugServer1Id = 'debug-server-1';
const spawnDebugServer1: CpManagerConfig = {
  id: debugServer1Id,
  managerConfig: {
    retry: {
      maxCount: 3,
      minInterval: 5000,
    },
  },
  spawnConfig: getSpawnAndIpcConfigByScript<CP.DebugServerConfig>(getCpScript('debug-server.ts'), {
    // spawnOptions: {
    //   stdio,
    // },
    maxWaitTime4Ipc: 20,
  }),
};

const debugServer2Id = 'debug-server-2';
const spawnDebugServer2: CpManagerConfig = {
  id: debugServer2Id,
  // managerConfig: {
  //   retry: {
  //     maxCount: 3,
  //     minInterval: 5000,
  //   },
  // },
  spawnConfig: getSpawnAndIpcConfigByScript<CP.DebugServerConfig>(getCpScript('debug-server.ts'), {
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

