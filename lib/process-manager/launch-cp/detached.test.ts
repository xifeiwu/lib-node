import path from 'path';
import {logColorful, getSpawnConfigByScript, CP} from '../service/external';
import {launchCpInDetachedMode} from './detached';
import {readProcInfo} from '../service';

const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');

export async function runDetachedDebugServer() {
  const cpId = 'detached-debug-server';
  const info = await launchCpInDetachedMode({
    id: cpId,
    spawnConfig: getSpawnConfigByScript<CP.DebugServerConfig>(debugServerScript, {
      params: [cpId],
      infoToCp: {
        port: 3456,
      },
      maxWaitTime4Ipc: 10,
    }),
  });
  logColorful({}, 'LaunchCp detached info:', info);

  const persisted = readProcInfo(cpId);
  logColorful({}, 'Persisted info:', persisted);
}
