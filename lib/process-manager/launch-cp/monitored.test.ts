import path from 'path';
import {logColorful, getSpawnConfigByScript, spwanInDetachedMode, CP} from '../service/external';
import type {LaunchCpConfig} from '../service';
import {readProcInfo} from '../service';
import {launchCpInMonitoredMode} from './monitored';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');
const monitoredScript = path.resolve(__dirname, './monitored.ts');

export async function runMonitoredDebugServerInDetachedMode() {
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
      logCpOut: true,
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

/**
 * Start monitor and script process not in detached mode
 * Can be used for debugging
 */
export async function runMonitoredDebugServer() {
  const cpId = 'monitored-debug-server';
  const info = await launchCpInMonitoredMode({
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
  });
  logColorful({}, 'LaunchCp monitored info:', info);

  const persisted = readProcInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);
}
