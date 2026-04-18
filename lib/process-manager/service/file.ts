import fs from 'fs';
import path from 'path';
import {DAEMON_ROOT_DIR, killProcessByPid, isProcessAlive, getProcessInfoByPid} from './external';
import {LaunchCpInfo, MonitorInfo} from './types';
import {PROCESS_INFO_FILE_NAME, PROCESS_LOG_ERR_FILE_NAME, PROCESS_LOG_OUT_FILE_NAME} from './constants';

export function getCpBaseDir(cpId: string): string {
  return path.join(DAEMON_ROOT_DIR, cpId);
}

export function getCpInfoDir(cpId: string): string {
  return path.join(getCpBaseDir(cpId), 'info');
}

export function getCpInfoPath(cpId: string): string {
  return path.join(getCpInfoDir(cpId), PROCESS_INFO_FILE_NAME);
}

export function getCpLogDir(cpId: string): string {
  return path.join(getCpBaseDir(cpId), 'log');
}

export function getCpLogOutPath(cpId: string): string {
  return path.join(getCpLogDir(cpId), PROCESS_LOG_OUT_FILE_NAME);
}

export function getCpLogErrPath(cpId: string): string {
  return path.join(getCpLogDir(cpId), PROCESS_LOG_ERR_FILE_NAME);
}

export function getCpMonitorDir(cpId: string): string {
  return path.join(getCpBaseDir(cpId), 'monitor');
}

/**
 * cp info is not reliable, it may be corrupted or missing.
 * @param cpId
 * @returns
 */
export function loadCpInfo(cpId: string): LaunchCpInfo | null {
  const filePath = getCpInfoPath(cpId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export interface CpKeyInfo {
  key: string;
  status: string;
  command: string;
  pid: number;
  monitorId: MonitorInfo['id'];
  outFilePath: string;
  errFilePath: string;
}

async function getCpKeyInfo(cpId: string): Promise<CpKeyInfo | null> {
  const info = loadCpInfo(cpId);
  if (!info) {
    return null;
  }
  const pid = info.spawn.pid;
  const outFilePath = info.spawn.responseFromCp?.outFilePath ?? getCpLogOutPath(cpId);
  const errFilePath = info.spawn.responseFromCp?.errFilePath ?? getCpLogErrPath(cpId);
  const pInfo = await getProcessInfoByPid(pid);
  return {
    key: cpId,
    status: pInfo ? pInfo.etime : 'dead',
    command: info.spawn.wholeScript,
    pid: info.spawn.pid,
    monitorId: info.monitor?.id,
    outFilePath,
    errFilePath,
  };
}

/**
 * Like {@link getCpKeyInfo} for every directory under {@link DAEMON_ROOT_DIR} (same coverage as {@link loadAllCpInfo}).
 * Order follows directory enumeration; entries align by index with {@link loadAllCpInfo} for the same filesystem state.
 */
export async function getAllCpKeyInfo(): Promise<(CpKeyInfo | null)[]> {
  if (!fs.existsSync(DAEMON_ROOT_DIR)) {
    return [];
  }
  const results: (CpKeyInfo | null)[] = [];
  const entries = fs.readdirSync(DAEMON_ROOT_DIR, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const cpId = entry.name;
    results.push(await getCpKeyInfo(cpId));
  }
  return results;
}

export function isCpAlive(cpId: string): boolean {
  const info = loadCpInfo(cpId);
  const pid = info?.spawn?.pid;
  return pid != null && isProcessAlive(pid);
}

export async function stopCp(cpId: string): Promise<void> {
  const info = loadCpInfo(cpId);
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
