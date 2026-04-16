import path from 'path';
import {CpWrapperConfig} from '../types';
import {logColorful, getSpawnConfigByScript, CP} from '../external';
import {CpWrapperDetached} from './detached';
import {loadInfo} from '../service';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');

export async function runDetachedDebugServer() {
  const cpId = 'detached-debug-server';
  const config: CpWrapperConfig = {
    id: cpId,
    spawnConfig: getSpawnConfigByScript<CP.DebugServerConfig>(debugServerScript, {
      params: [cpId],
      infoToCp: {
        port: 3456,
      },
      maxWaitTime4Ipc: 10,
    }),
  };
  const cpWrapper = new CpWrapperDetached(config);
  await cpWrapper.start();
  const info = cpWrapper.getInfo();
  logColorful({}, 'CpWrapperDetached info:', info);

  /** Verify persisted info can be loaded */
  const persisted = loadInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);
}
// runDetachedDebugServer();