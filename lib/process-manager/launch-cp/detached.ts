import path from 'path';
import {
  spwanInDetachedMode,
  getSpawnConfigByScript,
  serializeSpawnResponse,
  createRollingSnapshotWriter,
  makeSureDirExist,
} from '../service/external';
import type {SpawnConfig} from '../service/external';
import {getCpInfoDir, getCpLogDir, PROCESS_INFO_FILE_NAME} from '../service';
import type {LaunchCpConfig, LaunchCpInfo} from '../service';

export async function launchCpInDetachedMode(config: LaunchCpConfig): Promise<LaunchCpInfo> {
  const {id, spawnConfig: raw} = config;
  if (!raw) {
    throw new Error('spawnConfig is required');
  }
  const spawnConfig = typeof raw === 'string' ? getSpawnConfigByScript(raw) : raw;

  const logDir = getCpLogDir(id);
  makeSureDirExist(logDir);
  const enriched: SpawnConfig = {
    ...spawnConfig,
    infoToCp: {
      ...spawnConfig.infoToCp,
      logOutPath: path.join(logDir, 'out.log'),
      logErrPath: path.join(logDir, 'err.log'),
    },
  };

  const {finalSpawnConfig, ...spawnResponse} = await spwanInDetachedMode(enriched);

  const info: LaunchCpInfo = {
    mode: 'detached',
    config: {...config, spawnConfig},
    runtime: {
      phase: 'running',
      lastAction: 'start',
      spawnConfig: finalSpawnConfig,
    },
    spawnInfo: serializeSpawnResponse(spawnResponse),
  };

  const infoDir = getCpInfoDir(id);
  createRollingSnapshotWriter({dir: infoDir, basename: PROCESS_INFO_FILE_NAME, format: 'json'}).save(info);

  return info;
}
