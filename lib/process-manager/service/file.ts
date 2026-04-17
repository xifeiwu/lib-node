import fs from 'fs';
import path from 'path';
import {DAEMON_ROOT_DIR, killProcessByPid, isProcessAlive} from './external';
import {LaunchCpInfo, ResponseError} from './types';
import {PROCESS_INFO_FILE_NAME} from './constants';

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

/**
 * For each child dir under the daemon root (except `sockets`), load `info/index.json` like {@link loadCpInfo}.
 */
export function loadAllCpInfo(): {cpId: string; info: LaunchCpInfo | null}[] {
  const results: {cpId: string; info: LaunchCpInfo | null}[] = [];
  if (!fs.existsSync(DAEMON_ROOT_DIR)) {
    return results;
  }
  const entries = fs.readdirSync(DAEMON_ROOT_DIR, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const cpId = entry.name;
    results.push({cpId, info: loadCpInfo(cpId)});
  }
  return results;
}

export function isCpAlive(cpId: string): boolean {
  const info = loadCpInfo(cpId);
  const pid = info?.spawnInfo?.pid;
  return pid != null && isProcessAlive(pid);
}

export async function stopCp(cpId: string): Promise<void> {
  const info = loadCpInfo(cpId);
  if (!info) {
    throw new Error(`No info found for cpId: ${cpId}`);
  }
  const pid = info.spawnInfo?.pid;
  if (!pid) {
    throw new Error(`No pid found for cpId: ${cpId}`);
  }
  if (!isProcessAlive(pid)) {
    return;
  }
  await killProcessByPid([pid]);
}

export function getErrorResponse(err: Error | string): ResponseError {
  let message = err as string;
  if (err instanceof Error) {
    message = err.stack ? err.stack : err.message;
  }
  const errorResponse: ResponseError = {
    type: 'error',
    data: message,
  };
  return errorResponse;
}
