import path from 'path';
import {logColorful, getSpawnConfigByScript, CP} from '../service/external';
import {launchCpInMonitoredMode} from './monitored';
import {readProcInfo} from '../service';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');

export async function runMonitoredDebugServer() {
  const cpId = 'monitored-debug-server';
  const info = await launchCpInMonitoredMode(
    {
      id: cpId,
      spawnConfig: getSpawnConfigByScript<CP.DebugServerConfig>(debugServerScript, {
        params: [cpId],
        infoToCp: {
          port: 3457,
        },
        maxWaitTime4Ipc: 10,
      }),
    },
    {
      retry: {
        maxCount: 3,
        minInterval: 5000,
      },
    }
  );
  logColorful({}, 'LaunchCp monitored info:', info);

  const persisted = readProcInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);
}
