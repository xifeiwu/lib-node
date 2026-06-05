import path from 'path';
import assert from 'assert';
import {waitFor} from '../external';
import {getAFreePort} from '../net/service/common';
import {getProcessInfo} from '../process/service/info';
import {killProcessByPid} from '../process/service/kill';
import {CP} from '../types';
import {getSpawnConfigByScript, spawnAndTryIpc, spwanInDetachedMode} from './spawn';
import {logColorful} from '../log';

/**
 * Spawns utils/cp-script/debug-server.ts and exercises {@link spawnAndTryIpc} with IPC:
 * parent sends {@link CP.DebugServerConfig}, child replies with {@link CP.DebugServerIpcResponse}.
 */
export async function testSpawnAndTryIpcWithDebugServer() {
  const tag = 'testSpawnAndTryIpcDebugServer';
  const port = await getAFreePort(4000);
  const scriptPath = path.join(__dirname, '../utils/cp-script/debug-server.ts');
  const spawnConfig = getSpawnConfigByScript<CP.DebugServerConfig>(scriptPath, {
    params: [tag],
    spawnOptions: {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
    infoToCp: {port},
    maxWaitCpResInSec: 20,
  });
  const spawnInfo = await spawnAndTryIpc<CP.DebugServerConfig, CP.DebugServerIpcResponse>(spawnConfig);
  const {responseFromCp, childProcess, supportIpc} = spawnInfo;
  assert.equal(supportIpc, true);
  assert.ok(responseFromCp?.serverInfo);
  assert.equal(responseFromCp.serverInfo.port, port);
  const {infoList, pidToInfo} = await getProcessInfo({filter: {pid: childProcess.pid}});
  assert.equal(infoList.length, 1);
  assert.equal(infoList[0].pid, childProcess.pid);
  assert(await killProcessByPid([childProcess.pid], {pidToInfo, killChildren: false}));
  await waitFor(500);
  {
    const {infoList} = await getProcessInfo({filter: {command: tag}});
    assert.equal(infoList.length, 0);
  }
}

/**
 * Same child script as {@link testSpawnAndTryIpcWithDebugServer}, but uses {@link spwanInDetachedMode} so
 * `detached` and detached `stdio` are applied by default (caller does not pass them).
 */
export async function testSpwanInDetachedModeWithDebugServer() {
  const tag = 'testSpwanInDetachedModeDebugServer';
  const port = await getAFreePort(4000);
  const scriptPath = path.join(__dirname, '../utils/cp-script/debug-server.ts');
  const spawnConfig = getSpawnConfigByScript<CP.DebugServerConfig>(scriptPath, {
    params: [tag],
    infoToCp: {port},
    maxWaitCpResInSec: 20,
  });
  const {
    responseFromCp,
    childProcess,
    supportIpc,
    finalSpawnConfig: preparedConfig,
  } = await spwanInDetachedMode<CP.DebugServerConfig, CP.DebugServerIpcResponse>(spawnConfig);
  assert.equal(preparedConfig.spawnOptions.detached, true);
  assert.deepEqual(preparedConfig.spawnOptions.stdio, ['ignore', 'ignore', 'ignore', 'ipc']);
  assert.equal(supportIpc, true);
  assert.ok(responseFromCp?.serverInfo);
  assert.equal(responseFromCp.serverInfo.port, port);
  const {infoList} = await getProcessInfo({filter: {pid: childProcess.pid}});
  assert.equal(infoList.length, 1);
  assert.equal(infoList[0].pid, childProcess.pid);
  logColorful({color: 'green'}, responseFromCp);
  logColorful(
    {color: 'red'},
    `please kill process ${childProcess.pid} manually: kill -9 ${childProcess.pid}`
  );
}
