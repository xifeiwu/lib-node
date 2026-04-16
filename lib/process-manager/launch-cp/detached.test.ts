import path from 'path';
import {LaunchCpConfig} from '../types';
import {logColorful, getSpawnConfigByScript, CP} from '../external';
import {LaunchCpDetached} from './detached';
import {loadInfo} from '../service';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');

export async function runDetachedDebugServer() {
  const cpId = 'detached-debug-server';
  const config: LaunchCpConfig = {
    id: cpId,
    clusterId: 'test',
    spawnConfig: getSpawnConfigByScript<CP.DebugServerConfig>(debugServerScript, {
      params: [cpId],
      infoToCp: {
        port: 3456,
      },
      maxWaitTime4Ipc: 10,
    }),
  };
  const cpWrapper = new LaunchCpDetached(config);
  await cpWrapper.start();
  const info = cpWrapper.getInfo();
  logColorful({}, 'LaunchCpDetached info:', info);

  /** Wait for async info writes to flush, then verify persisted info */
  await cpWrapper.flushInfo();
  const persisted = loadInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);
}
