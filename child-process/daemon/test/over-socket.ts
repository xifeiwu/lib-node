import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {getCpConfigByScriptName, getScriptFullpath, spawnScript} from '../../run-on-cp';
import {logColorful, fromBuffer, CP, getSocketPath} from '../../../index';
import {getDaemonCpConfigByScriptPath, startDetachedDaemon} from '../service';
import {SocketClient} from '../client/socket';

const spawnDebugServer = getDaemonCpConfigByScriptPath<CP.DebugServerConfig>(
  getScriptFullpath('debug-server.ts'),
  {
    id: 'debug-server-1',
    infoToCp: {},
    maxWaitTime4Ipc: 20,
  }
);

const daemonKey = 'testStartDetachedDaemon';
const socketPath = getSocketPath(daemonKey);
const socketClient = new SocketClient({path: socketPath});

export async function testStartDetachedDaemon() {
  // const spawnConfigDebugServer = getSpawnConfigByScriptName('debug-server.ts', {
  //   args: [],
  //   spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
  //   infoToCp: {},
  //   maxWaitTime4Ipc: 10,
  // });
  const spawnResponse = await startDetachedDaemon(
    {
      daemonKey,
      cpConfigList: [spawnDebugServer],
    },
    {debug: true}
  );
  logColorful({}, spawnResponse);
}

export async function testPing() {
  const response = await socketClient.ping();
  logColorful({}, response);
}
export async function testInfo() {
  const response = await socketClient.info();
  logColorful({}, response);
}

export async function testStop() {
  const response = await socketClient.stop();
  logColorful({}, response);
}
