import path from 'path';
import {logColorful, getSpawnConfigByScript, spwanInDetachedMode, CP} from '../service/external';
import type {LaunchCpConfig} from '../service';
import {readProcInfo} from '../service';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');
const monitoredScript = path.resolve(__dirname, './monitored.ts');

export async function runMonitoredDebugServer() {
  const cpId = 'monitored-debug-server';
  const config: LaunchCpConfig = {
    id: cpId,
    spawnConfig: getSpawnConfigByScript<CP.DebugServerConfig>(debugServerScript, {
      params: [cpId],
      infoToCp: {
        port: 3457,
      },
      maxWaitTime4Ipc: 10,
    }),
    monitorConfig: {
      retry: {
        maxCount: 3,
        minInterval: 5000,
      },
    },
  };

  const monitorSpawnConfig = getSpawnConfigByScript<LaunchCpConfig>(monitoredScript, {
    infoToCp: config,
    maxWaitTime4Ipc: 15,
  });
  const {finalSpawnConfig, ...spawnResponse} = await spwanInDetachedMode(monitorSpawnConfig);
  logColorful({}, 'Monitor process spawned (detached):', spawnResponse);

  const persisted = readProcInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);
}
