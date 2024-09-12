import assert from 'assert';
import {
  DebugServerClusterConfig,
  DebugServerClusterResponse,
  DebugServerConfig,
  DebugServerResponse,
  getSpawnConfigByScriptName,
  spawnScript,
} from './index';
import {logColorful, getAFreePort, getProcessInfo, killProcessByPid, spawnAndTryIpc} from '../../index';

export async function testSpawnTsScript() {
  const tag = 'testSpawnTsScript';
  const port = await getAFreePort(4000);
  const {command, args, spawnOptions, responseFromCp, childProcess} = await spawnScript<
    DebugServerConfig,
    DebugServerResponse
  >('debug-server.ts', {
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
  logColorful({}, {pid: childProcess.pid, command, args, spawnOptions});
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
