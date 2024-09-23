import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {getSpawnConfigByScriptName, spawnScript} from './index';
import {
  logColorful,
  getAFreePort,
  getProcessInfo,
  killProcessByPid,
  spawnAndTryIpc,
  serializeSpawnResponse,
  fromBuffer,
} from '../../index';
import {CP} from '../../types';

export async function testDebugServer() {
  const tag = 'testSpawnTsScript';
  const port = await getAFreePort(4000);
  const spawnInfo = await spawnScript<CP.DebugServerConfig, CP.DebugServerResponse>('debug-server.ts', {
    args: [tag],
    spawnOptions: {
      stdio: ['ipc', 'ignore', 'ignore'],
    },
    infoToCp: {
      config: {
        port,
      },
    },
  });
  const {responseFromCp, childProcess} = spawnInfo;
  logColorful({}, serializeSpawnResponse(spawnInfo));
  assert.equal(responseFromCp.port, port);
  const {infoList, pidToInfo} = await getProcessInfo({filter: {pid: childProcess.pid}});
  assert.equal(infoList.length, 1);
  assert.equal(infoList[0].pid, childProcess.pid);
  assert(killProcessByPid([childProcess.pid], {pidToInfo, killChildren: false}));
  {
    const {infoList} = await getProcessInfo({filter: {command: tag}});
    assert.equal(infoList.length, 0);
  }
}

export async function runDebugServerCluster() {
  const port = await getAFreePort(4000);
  const moreArgs = ['runTDebugServerCluster'];
  const spawnConfig = getSpawnConfigByScriptName('debug-server-cluster.ts', {
    args: moreArgs,
    spawnOptions: {
      stdio: ['ipc', 'ignore', 'ignore'],
    },
    infoToCp: {
      config: {
        port,
        slaveCount: 2,
      },
      spawnConfig: {
        command: 'ts-node',
        args: moreArgs,
        spawnOptions: {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        },
        infoToCp: {},
      },
    },
  });
  const {responseFromCp, childProcess} = await spawnAndTryIpc<
    CP.DebugServerClusterConfig,
    CP.DebugServerClusterResponse
  >(spawnConfig);
  // childProcess.stdout.pipe(process.stdout);
  logColorful({}, {spawnConfig, responseFromCp});
}
