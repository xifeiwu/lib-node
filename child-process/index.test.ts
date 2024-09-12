import assert from 'assert';
import {
  DebugServerClusterConfig,
  DebugServerClusterResponse,
  DebugServerConfig,
  DebugServerResponse,
  runTsScriptInChildProcess,
} from '.';
import {logColorful} from '../log';
import {getAFreePort} from '../net';
import {getProcessInfo, killProcessByPid} from '../index';

export async function testRunTsScriptInChildProcess() {
  const tag = 'testRunTsScriptInChildProcess';
  const port = await getAFreePort(4000);
  const {command, params, spawnOptions, childProcessResponse, pid} = await runTsScriptInChildProcess<
    DebugServerConfig,
    DebugServerResponse
  >('debug-server', {
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
  logColorful({}, {pid, command, params, spawnOptions});
  assert.equal(childProcessResponse.port, port);
  const {infoList, pidToInfo} = await getProcessInfo({filter: {pid}});
  assert.equal(infoList.length, 1);
  assert.equal(infoList[0].pid, pid);
  assert(killProcessByPid([pid], {pidToInfo, killChildren: false}));
  {
    const {infoList} = await getProcessInfo({filter: {command: tag}});
    assert.equal(infoList.length, 0);
  }
}

export async function runDebugServerCluster() {
  const port = await getAFreePort(4000);
  const args = ['runTDebugServerCluster'];
  const {command, params, spawnOptions, childProcessResponse, pid, childProcess} =
    await runTsScriptInChildProcess<DebugServerClusterConfig, DebugServerClusterResponse>(
      'debug-server-cluster',
      {
        args: ['runTDebugServerCluster'],
        spawnOptions: {
          stdio: ['ipc', 'ignore', 'ignore'],
        },
        infoToCp: {
          config: {
            port,
            slaveCount: 2,
          },
          cpConfig: {
            args,
            spawnOptions: {
              stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
            },
          },
        },
      }
    );
  // childProcess.stdout.pipe(process.stdout);
  logColorful({}, {pid, command, params, spawnOptions, childProcessResponse});
}
