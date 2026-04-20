/**
 * save/read process info to/from file system
 */
import fs from 'fs';
import path from 'path';
import {PROCESS_MANAGER_ROOT_DIR} from './external';
import {LaunchCpInfo, MonitorInfo} from './types';
import {PROCESS_INFO_FILE_NAME, PROCESS_LOG_ERR_FILE_NAME, PROCESS_LOG_OUT_FILE_NAME} from './constants';

export function getProcBaseDir(cpId: string): string {
  return path.join(PROCESS_MANAGER_ROOT_DIR, cpId);
}

export function getProcInfoDir(cpId: string): string {
  return path.join(getProcBaseDir(cpId), 'info');
}

export function getProcInfoPath(cpId: string): string {
  return path.join(getProcInfoDir(cpId), PROCESS_INFO_FILE_NAME);
}

export function getProcLogDir(cpId: string): string {
  return path.join(getProcBaseDir(cpId), 'log');
}

export function getProcLogOutPath(cpId: string): string {
  return path.join(getProcLogDir(cpId), PROCESS_LOG_OUT_FILE_NAME);
}

export function getProcLogErrPath(cpId: string): string {
  return path.join(getProcLogDir(cpId), PROCESS_LOG_ERR_FILE_NAME);
}

export function getProcMonitorDir(cpId: string): string {
  return path.join(getProcBaseDir(cpId), 'monitor');
}

/**
 * cp info is not reliable, it may be corrupted or missing.
 * @param cpId
 * @returns
 */
export function readProcInfo(cpId: string): LaunchCpInfo | null {
  const filePath = getProcInfoPath(cpId);
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
