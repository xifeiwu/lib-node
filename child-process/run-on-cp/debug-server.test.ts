import {ChildProcess} from 'child_process';
import {CP, getAFreePort, logColorful, serializeSpawnResponse, spawnScript} from '../../index';

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
  childProcess.disconnect && childProcess.disconnect();
  childProcess.unref();
}
