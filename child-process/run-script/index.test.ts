import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {
  DaemonConfig,
  DaemonResponse,
  DebugServerClusterConfig,
  DebugServerClusterResponse,
  DebugServerConfig,
  DebugServerResponse,
  getSpawnConfigByScriptName,
  spawnScript,
} from './index';
import {
  logColorful,
  getAFreePort,
  getProcessInfo,
  killProcessByPid,
  spawnAndTryIpc,
  toSpawnRelatedInfo,
  getClientSocket,
  fromBuffer,
} from '../../index';

export async function testDebugServer() {
  const tag = 'testSpawnTsScript';
  const port = await getAFreePort(4000);
  const spawnInfo = await spawnScript<DebugServerConfig, DebugServerResponse>('debug-server.ts', {
    args: [tag],
    spawnOptions: {
      stdio: ['ipc', 'ignore', 'ignore'],
    },
    waitFirstIpc: true,
    infoToCp: {
      config: {
        port,
      },
    },
  });
  const {responseFromCp, childProcess} = spawnInfo;
  logColorful({}, toSpawnRelatedInfo(spawnInfo));
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
    waitFirstIpc: true,
    infoToCp: {
      config: {
        port,
        slaveCount: 2,
      },
      spawnConfig: {
        args: moreArgs,
        spawnOptions: {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        },
        waitFirstIpc: true,
      },
    },
  });
  const {responseFromCp, childProcess} = await spawnAndTryIpc<
    DebugServerClusterConfig,
    DebugServerClusterResponse
  >(spawnConfig);
  // childProcess.stdout.pipe(process.stdout);
  logColorful({}, {spawnConfig, responseFromCp});
}

export async function runDaemon() {
  // await spawnAndTryIpc({})
  const {childProcess, responseFromCp} = await spawnScript<DaemonConfig, DaemonResponse>('daemon.ts', {
    waitFirstIpc: true,
    spawnOptions: {
      stdio: ['ipc'],
    },
  });
  logColorful({}, responseFromCp);
  const {socketPath} = responseFromCp;
  const {pid} = await new Promise<DaemonResponse>((res, rej) => {
    const client = net.createConnection(socketPath);
    client.on('data', chunk => {
      res(fromBuffer(chunk, 'json') as DaemonResponse);
    });
    client.on('error', err => {
      rej(err);
    });
  });
  assert.equal(pid, childProcess.pid);
  childProcess.kill();
  fs.unlinkSync(socketPath);
}
