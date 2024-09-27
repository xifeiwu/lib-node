import assert from 'assert';
import {
  CP,
  getAFreePort,
  getProcessInfo,
  killProcessByPid,
  logColorful,
  serializeSpawnResponse,
  spawnScript,
} from '../../index';

export async function testDebugServer() {
  const tag = 'testSpawnTsScript';
  const port = await getAFreePort(4000);
  const spawnInfo = await spawnScript<CP.DebugServerConfig, CP.DebugServerResponse>('debug-server.ts', {
    args: [tag],
    spawnOptions: {
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    },
    infoToCp: {
      config: {
        port,
      },
    },
    maxWaitTime4Ipc: 20,
  });
  const {responseFromCp, childProcess} = spawnInfo;
  logColorful({}, serializeSpawnResponse(spawnInfo));
  assert.equal(responseFromCp.port, port);
  const {infoList, pidToInfo} = await getProcessInfo({filter: {pid: childProcess.pid}});
  assert.equal(infoList.length, 1);
  assert.equal(infoList[0].pid, childProcess.pid);
  assert(await killProcessByPid([childProcess.pid], {pidToInfo, killChildren: false}));
  {
    const {infoList} = await getProcessInfo({filter: {command: tag}});
    assert.equal(infoList.length, 0);
  }
}

export async function debugDebugServer() {
  const tag = 'debugDebugServer';
  const port = await getAFreePort(4000);
  const spawnInfo = await spawnScript<CP.DebugServerConfig, CP.DebugServerResponse>('debug-server.ts', {
    args: [tag],
    spawnOptions: {
      stdio: [0, 1, 2, 'ipc'],
    },
    infoToCp: {
      config: {
        port,
      },
    },
    maxWaitTime4Ipc: 6,
  });
  const {childProcess} = spawnInfo;
  logColorful({}, serializeSpawnResponse(spawnInfo));
  // childProcess.disconnect && childProcess.disconnect();
  // childProcess.unref();
}

export async function testCustomization() {
  const tag = 'testCustomization';
  const port = await getAFreePort(4000);
  const spawnInfo = await spawnScript<CP.DebugServerConfig, CP.DebugServerResponse>('debug-server.ts', {
    args: [tag],
    spawnOptions: {
      stdio: [0, 1, 2, 'ipc'],
    },
    infoToCp: {
      config: {
        port,
        delay: 10000,
        errorMessage: 'trigger by demend',
      },
    },
    maxWaitTime4Ipc: 6,
  });
  const {childProcess} = spawnInfo;
  logColorful({}, serializeSpawnResponse(spawnInfo));
}
