import path from 'path';
import {
  spwanInDetachedMode,
  serializeSpawnResponse,
  createRollingSnapshotWriter,
  makeSureDirExist,
} from '../service/external';
import type {SpawnConfig} from '../service/external';
import {
  getProcInfoDir,
  getProcLogDir,
  PROCESS_INFO_FILE_NAME,
  PROCESS_LOG_ERR_FILE_NAME,
  PROCESS_LOG_OUT_FILE_NAME,
  resolveLaunchSpawnConfig,
} from '../service';
import type {LaunchCpConfig, LaunchCpInfo} from '../service';

export async function launchCpInDetachedMode(config: LaunchCpConfig): Promise<LaunchCpInfo> {
  const {id, spawnConfig: raw} = config;
  if (!raw) {
    throw new Error('spawnConfig is required');
  }
  const spawnConfig = resolveLaunchSpawnConfig(raw);

  const logDir = getProcLogDir(id);
  makeSureDirExist(logDir);
  const enriched: SpawnConfig = {
    ...spawnConfig,
    infoToCp: {
      ...spawnConfig.infoToCp,
      logOutPath: path.join(logDir, PROCESS_LOG_OUT_FILE_NAME),
      logErrPath: path.join(logDir, PROCESS_LOG_ERR_FILE_NAME),
    },
  };

  const {finalSpawnConfig, ...spawnResponse} = await spwanInDetachedMode(enriched);

  const info: LaunchCpInfo = {
    mode: 'detached',
    config,
    runtime: {
      phase: 'running',
      lastAction: 'start',
      spawnConfig: finalSpawnConfig,
    },
    spawn: serializeSpawnResponse(spawnResponse),
  };

  const infoDir = getProcInfoDir(id);
  createRollingSnapshotWriter({dir: infoDir, basename: PROCESS_INFO_FILE_NAME, format: 'json'}).save(info);

  return info;
}
