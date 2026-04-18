import path from 'path';
import {
  spawnAndTryIpc,
  getSpawnConfigByScript,
  serializeSpawnResponse,
  createRollingSnapshotWriter,
  createRollingLogWriter,
  makeSureDirExist,
  isNumber,
  waitFor,
  get,
  waitIpcMessageOnce,
} from '../service/external';
import type {
  SpawnConfig,
  SpawnAndTryIpcResponse,
  RollingLogWriter,
  RollingSnapshotWriter,
} from '../service/external';
import {
  getProcInfoDir,
  getProcLogDir,
  getProcMonitorDir,
  PROCESS_INFO_FILE_NAME,
  MONITORED_STDIO,
  MONITOR_CHANGES_FILE_NAME,
  PROCESS_LOG_ERR_FILE_NAME,
  PROCESS_LOG_OUT_FILE_NAME,
} from '../service';
import type {LaunchCpConfig, LaunchCpEntry, LaunchCpInfo, MonitorConfig} from '../service';

export function validateAndApplyStdio(spawnConfig: SpawnConfig, defaultStdio: any[]): SpawnConfig {
  const config = {...spawnConfig};
  if (!config.spawnOptions) {
    config.spawnOptions = {};
  }
  config.spawnOptions = {...config.spawnOptions};
  const userStdio = config.spawnOptions.stdio;
  if (!userStdio) {
    config.spawnOptions.stdio = defaultStdio;
    return config;
  }
  if (!Array.isArray(userStdio)) {
    throw new Error(`stdio must be an array, got: ${JSON.stringify(userStdio)}`);
  }
  const stdio = [...userStdio] as any[];
  for (let i = 0; i < defaultStdio.length; i++) {
    const userVal = stdio[i];
    const defaultVal = defaultStdio[i];
    if (userVal === undefined) {
      stdio[i] = defaultVal;
    } else if (userVal !== defaultVal) {
      throw new Error(`stdio[${i}] is set to '${userVal}', but '${defaultVal}' is required for this mode`);
    }
  }
  config.spawnOptions.stdio = stdio;
  return config;
}

export async function launchCpInMonitoredMode(
  config: LaunchCpConfig,
  monitorConfig: MonitorConfig
): Promise<LaunchCpInfo> {
  const {id, spawnConfig: raw} = config;
  if (!raw) {
    throw new Error('spawnConfig is required');
  }
  const spawnConfig = typeof raw === 'string' ? getSpawnConfigByScript(raw) : raw;
  const prepared = validateAndApplyStdio(spawnConfig, MONITORED_STDIO);

  const logDir = getProcLogDir(id);
  makeSureDirExist(logDir);
  const enriched: SpawnConfig = {
    ...prepared,
    infoToCp: {
      ...prepared.infoToCp,
      logOutPath: path.join(logDir, PROCESS_LOG_OUT_FILE_NAME),
      logErrPath: path.join(logDir, PROCESS_LOG_ERR_FILE_NAME),
    },
  };

  const infoDir = getProcInfoDir(id);
  const infoWriter = createRollingSnapshotWriter({
    dir: infoDir,
    basename: PROCESS_INFO_FILE_NAME,
    format: 'json',
  });

  const monitorDir = getProcMonitorDir(id);
  const changesWriter = createRollingLogWriter({dir: monitorDir, basename: MONITOR_CHANGES_FILE_NAME});

  let outWriter: RollingLogWriter | undefined;
  let errWriter: RollingLogWriter | undefined;
  if (monitorConfig.logCpOut) {
    outWriter = createRollingLogWriter({dir: logDir, basename: PROCESS_LOG_OUT_FILE_NAME});
    errWriter = createRollingLogWriter({dir: logDir, basename: PROCESS_LOG_ERR_FILE_NAME});
  }

  let retryCount = 0;

  const buildInfo = (result: SpawnAndTryIpcResponse): LaunchCpInfo => ({
    mode: 'monitored',
    config: {...config, spawnConfig},
    runtime: {
      phase: 'running',
      lastAction: 'start',
      spawnConfig: enriched,
    },
    monitor: {
      id: process.pid,
      retryCount,
    },
    spawn: serializeSpawnResponse(result),
  });

  const doSpawn = async (): Promise<SpawnAndTryIpcResponse> => {
    const result = await spawnAndTryIpc(enriched);
    const {childProcess} = result;

    changesWriter.write(`[${new Date().toISOString()}] spawned pid=${childProcess.pid}\n`);
    infoWriter.save(buildInfo(result));

    if (monitorConfig.logCpOut) {
      childProcess.stdout?.on('data', (chunk: Buffer) => outWriter.write(chunk));
      childProcess.stderr?.on('data', (chunk: Buffer) => {
        outWriter.write(chunk);
        errWriter.write(chunk);
      });
    }

    childProcess.once('exit', async code => {
      changesWriter.write(`[${new Date().toISOString()}] exited code=${code}\n`);

      const {maxCount, minInterval} = get(monitorConfig, ['retry'], {});
      if (isNumber(maxCount) && retryCount < maxCount) {
        retryCount++;
        changesWriter.write(`[${new Date().toISOString()}] retry ${retryCount}/${maxCount}\n`);
        if (isNumber(minInterval)) {
          await waitFor(minInterval);
        }
        await doSpawn();
      } else {
        outWriter?.end();
        errWriter?.end();
        changesWriter.end();
      }
    });

    return result;
  };

  const result = await doSpawn();
  return buildInfo(result);
}

// Script entry point: runs when this file is spawned as a child process
if (require.main === module) {
  (async () => {
    const payload = await waitIpcMessageOnce<LaunchCpEntry>();
    if (!payload) {
      process.exit(1);
    }
    const {cpConfig, monitorConfig} = payload;
    const results = await launchCpInMonitoredMode(cpConfig, monitorConfig);
    process.send?.(results);
  })();
}
