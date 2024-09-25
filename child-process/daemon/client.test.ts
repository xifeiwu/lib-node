import {logColorful} from '../../log';
import {getSpawnConfigByScriptName} from '../run-on-cp';
import {checkDaemonSocketActivityByDir, ping, info, stop, start} from './client';
import {DaemonSocketDir} from './service';

const targetSocketPath = '/Users/wuxifei/.daemon/sockets/debug-server.socket';
export async function testPing() {
  const response = await ping(targetSocketPath);
  logColorful({}, response);
}

export async function testInfo() {
  const response = await info(targetSocketPath);
  logColorful({}, response);
}
export async function testStop() {
  const response = await stop(targetSocketPath);
  logColorful({}, response);
}

export async function testStart() {
  const response = await start(targetSocketPath);
  logColorful({}, response);
}

export async function testStartWithSpawnInfo() {
  const spawnConfigDebugServer = getSpawnConfigByScriptName('debug-server.ts', {
    args: [],
    spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 10,
  });
  const response = await start(targetSocketPath, {
    config: {socketPath: {basename: 'debug-server.socket'}},
    spawnConfig: spawnConfigDebugServer,
  });
  logColorful({}, response);
}
export async function testCheckSocketActivity() {
  const results = await checkDaemonSocketActivityByDir(DaemonSocketDir);
  logColorful({}, results);
}
