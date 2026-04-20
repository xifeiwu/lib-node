/**
 * logic based on file system
 */
import fs from 'fs';
import {
  PROCESS_MANAGER_ROOT_DIR,
  killProcessByPid,
  isProcessAlive,
  getProcessInfoByPid,
} from '../service/external';
import type {KillProcOptions, LaunchCpConfig, LaunchCpInfo, ProcKeyInfo} from '../service/types';
import {readProcInfo, getProcLogOutPath, getProcLogErrPath, getProcBaseDir} from '../service/file';
import {launchCpInMonitoredMode} from '../launch-cp/monitored';
import {launchCpInDetachedMode} from '../launch-cp/detached';

function isManagedProcPidAlive(cpId: string): boolean {
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

export async function startProcess(config: LaunchCpConfig) {
  const {id} = config;
  if (isManagedProcPidAlive(id)) {
    throw new Error(`Process "${id}" is already running, cannot start again.`);
  }
  return config.monitorConfig ? await launchCpInMonitoredMode(config) : await launchCpInDetachedMode(config);
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
  }
  if (options?.cleanUp) {
    removeProcBaseDir(cpId);
  }
  return pids;
}

export async function restartProcess(
  config: LaunchCpConfig,
  options?: KillProcOptions
): Promise<LaunchCpInfo> {
  await killProc(config.id, options);
  return await startProcess(config);
}
