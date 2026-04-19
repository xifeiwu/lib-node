import fs from 'fs';
import {DAEMON_ROOT_DIR, killProcessByPid, isProcessAlive, getProcessInfoByPid} from './external';
import type {ProcKeyInfo} from './types';
import {readProcInfo, getProcLogOutPath, getProcLogErrPath} from './file';

async function getProcKeyInfo(cpId: string): Promise<ProcKeyInfo | null> {
  const info = readProcInfo(cpId);
  if (!info) {
    return null;
  }
  const pid = info.spawn.pid;
  const outFilePath = info.spawn.responseFromCp?.outFilePath ?? getProcLogOutPath(cpId);
  const errFilePath = info.spawn.responseFromCp?.errFilePath ?? getProcLogErrPath(cpId);
  const pInfo = await getProcessInfoByPid(pid);
  const monitorPid = info.monitor?.id;
  // const monitorInfo = await getProcessInfoByPid(monitorPid);
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
 * Like {@link getProcKeyInfo} for every directory under {@link DAEMON_ROOT_DIR} (same enumeration as iterating
 * each `cpId` and calling {@link readProcInfo}).
 */
export async function getAllProcKeyInfo(): Promise<(ProcKeyInfo | null)[]> {
  if (!fs.existsSync(DAEMON_ROOT_DIR)) {
    return [];
  }
  const results: (ProcKeyInfo | null)[] = [];
  const entries = fs.readdirSync(DAEMON_ROOT_DIR, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const cpId = entry.name;
    results.push(await getProcKeyInfo(cpId));
  }
  return results;
}

export function isProcAlive(cpId: string): boolean {
  const info = readProcInfo(cpId);
  const pid = info?.spawn?.pid;
  return pid != null && isProcessAlive(pid);
}

export async function stopProc(cpId: string): Promise<void> {
  const info = readProcInfo(cpId);
  if (!info) {
    throw new Error(`No info found for cpId: ${cpId}`);
  }
  const pid = info.spawn?.pid;
  if (!pid) {
    throw new Error(`No pid found for cpId: ${cpId}`);
  }
  if (!isProcessAlive(pid)) {
    return;
  }
  await killProcessByPid([pid]);
}
