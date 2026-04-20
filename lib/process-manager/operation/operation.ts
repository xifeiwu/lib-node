/**
 * logic based on file system
 */
import fs from 'fs';
import path from 'path';
import {
  PROCESS_MANAGER_ROOT_DIR,
  killProcessByPid,
  isProcessAlive,
  getProcessInfoByPid,
  getSpawnConfigByScript,
  spwanInDetachedMode,
  getPreferredFileByExt,
} from '../service/external';
import type {
  KillProcOptions,
  LaunchCpConfig,
  LaunchCpInfo,
  ProcKeyInfo,
  StartProcOptions,
} from '../service/types';
import {readProcInfo, getProcLogOutPath, getProcLogErrPath, getProcBaseDir} from '../service/file';
import {launchCpInDetachedMode} from '../launch-cp/detached';
/**
 * import this function to make sure the monitored script will be included during compile porcess
 */
import {launchCpInMonitoredMode} from '../launch-cp/monitored';

export function isManagedProcPidAlive(cpId: string): boolean {
  const info = readProcInfo(cpId);
  if (!info) {
    return false;
  }
  const mon = info.monitor?.id;
  const sp = info.spawn?.pid;
  if (mon != null && sp != null && mon !== sp && isProcessAlive(mon)) {
    return true;
  }
  if (sp != null && isProcessAlive(sp)) {
    return true;
  }
  return false;
}

async function launchMonitoredInDetachedMode(config: LaunchCpConfig): Promise<LaunchCpInfo> {
  const monitoredScript = getPreferredFileByExt(path.resolve(__dirname, '../launch-cp/monitored.ts'), {
    preferredExtSequence: ['.js'],
  });
  const monitorSpawnConfig = getSpawnConfigByScript<LaunchCpConfig>(monitoredScript, {
    infoToCp: config,
    maxWaitTime4Ipc: 15,
  });
  await spwanInDetachedMode(monitorSpawnConfig);
  return readProcInfo(config.id);
}

export async function startProcess(config: LaunchCpConfig, options?: StartProcOptions) {
  const {id} = config;
  if (isManagedProcPidAlive(id)) {
    throw new Error(`Process "${id}" is already running, cannot start again.`);
  }
  let mode = options?.mode ?? (config.monitorConfig ? 'monitored' : 'detached');

  return mode === 'monitored'
    ? await launchMonitoredInDetachedMode(config)
    : await launchCpInDetachedMode(config);
}

export async function getProcKeyInfo(cpId: string): Promise<ProcKeyInfo | null> {
  const info = readProcInfo(cpId);
  if (!info) {
    return null;
  }
  const pid = info.spawn.pid;
  const outFilePath = info.spawn.responseFromCp?.outFilePath ?? getProcLogOutPath(cpId);
  const errFilePath = info.spawn.responseFromCp?.errFilePath ?? getProcLogErrPath(cpId);
  const pInfo = await getProcessInfoByPid(pid);
  const monitorPid = info.monitor?.id;
  return {
    key: cpId,
    status: pInfo ? pInfo.etime : 'dead',
    monitorPid,
    command: info.spawn.wholeScript,
    pid: info.spawn.pid,
    rss: pInfo?.rssWord ?? '0B',
    outFilePath,
    errFilePath,
  };
}

/**
 * Like {@link getProcKeyInfo} for every directory under {@link PROCESS_MANAGER_ROOT_DIR} (same enumeration as iterating
 * each `cpId` and calling {@link readProcInfo}).
 */
export async function listProcKeyInfo(): Promise<(ProcKeyInfo | null)[]> {
  if (!fs.existsSync(PROCESS_MANAGER_ROOT_DIR)) {
    return [];
  }
  const results: (ProcKeyInfo | null)[] = [];
  const entries = fs.readdirSync(PROCESS_MANAGER_ROOT_DIR, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const cpId = entry.name;
    results.push(await getProcKeyInfo(cpId));
  }
  return results;
}

/**
 * Deletes {@link getProcBaseDir} for `cpId` (info, log, monitor, etc.).
 * Refuses while any persisted spawn/monitor PID is still alive.
 * No-ops if the directory is already absent.
 */
export function removeProcBaseDir(cpId: string): string {
  if (isManagedProcPidAlive(cpId)) {
    throw new Error(
      `Cannot remove process base dir for "${cpId}": process is still running. Stop it first (e.g. killProc).`
    );
  }
  const dir = getProcBaseDir(cpId);
  if (!fs.existsSync(dir)) {
    return;
  }
  fs.rmSync(dir, {recursive: true, force: true});
  return dir;
}

const DEFAULT_KILL_MAX_WAIT_MS = 10_000;
const KILL_EXIT_POLL_MS = 1_000;

async function waitUntilManagedProcDead(cpId: string, maxWaitMs: number): Promise<void> {
  const deadline = Date.now() + maxWaitMs;
  while (isManagedProcPidAlive(cpId)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `Process "${cpId}" is still alive after ${maxWaitMs}ms (polled every ${KILL_EXIT_POLL_MS}ms) following kill.`
      );
    }
    await new Promise<void>(r => setTimeout(r, KILL_EXIT_POLL_MS));
  }
}

export async function killProc(cpId: string, options?: KillProcOptions): Promise<number[]> {
  const info = readProcInfo(cpId);
  if (!info) return [];
  const pids: number[] = [];
  const mon = info.monitor?.id;
  const sp = info.spawn?.pid;
  if (mon != null && sp != null && mon !== sp && isProcessAlive(mon)) {
    pids.push(mon);
  }
  if (sp != null && isProcessAlive(sp)) {
    pids.push(sp);
  }
  if (pids.length > 0) {
    await killProcessByPid(pids);
    const maxWaitMs = options?.maxWaitMs ?? DEFAULT_KILL_MAX_WAIT_MS;
    await waitUntilManagedProcDead(cpId, maxWaitMs);
  }
  if (options?.cleanUp) {
    removeProcBaseDir(cpId);
  }
  return pids;
}

export async function restartProcess(
  config: LaunchCpConfig,
  killOptions?: KillProcOptions,
  startOptions?: StartProcOptions
): Promise<LaunchCpInfo> {
  await killProc(config.id, killOptions);
  return await startProcess(config, startOptions);
}
