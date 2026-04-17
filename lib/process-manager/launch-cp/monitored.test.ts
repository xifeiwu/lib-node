import path from 'path';
import {LaunchCpConfig, MonitorConfig} from '../service';
import {logColorful, getSpawnConfigByScript, CP} from '../service/external';
import {LaunchCp} from './launch-cp';
import {loadCpInfo} from '../service';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');

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
  };
  const monitorConfig: MonitorConfig = {
    retry: {
      maxCount: 3,
      minInterval: 5000,
    },
  };
  const cpWrapper = new LaunchCp(config);
  await cpWrapper.startInMonitoredMode(monitorConfig);
  const info = cpWrapper.getInfo();
  logColorful({}, 'LaunchCp monitored info:', info);

  /** Wait for async info writes to flush, then verify persisted info */
  await cpWrapper.flushInfo();
  const persisted = loadCpInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);

  /** Stop the child process */
  await cpWrapper.stop();
  const stoppedInfo = cpWrapper.getInfo();
  logColorful({}, 'Stopped info:', stoppedInfo);
}
