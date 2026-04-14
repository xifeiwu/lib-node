import fs from 'fs';
import path from 'path';
import {TcpServerInfo, DAEMON_ROOT_DIR, writeFileSync} from './external';
import {CpInfo, PidInfoRecord, ResponseError, SerializableCpInfo} from './types';

export const MAX_WAIT_TIME_DEBUG_MODE = 120;

export function serializeCpInfo(cpInfo: CpInfo): SerializableCpInfo {
  const {childProcess, ...rest} = cpInfo;
  return {
    pid: childProcess?.pid,
    ...rest,
  };
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
export function serializeSocketServerInfo(info: TcpServerInfo) {
  const {path: socketPath, host, port} = info;
  if (socketPath) {
    return {path: socketPath};
  } else {
    return {host, port};
  }
}

export function getCpDir(cpId: string): string {
  return path.join(DAEMON_ROOT_DIR, cpId);
}

export function getPidInfoPath(cpId: string): string {
  return path.join(getCpDir(cpId), 'pid-info.json');
}

export function getLogSocketPath(cpId: string, pid: number): string {
  return path.join(getCpDir(cpId), `${pid}.sock`);
}

export function getLogOutFilePath(cpId: string, pid: number): string {
  return path.join(getCpDir(cpId), `${pid}.out`);
}

export function getLogErrorFilePath(cpId: string, pid: number): string {
  return path.join(getCpDir(cpId), `${pid}.error`);
}

export function savePidInfo(cpId: string, record: PidInfoRecord): void {
  const filePath = getPidInfoPath(cpId);
  writeFileSync(filePath, JSON.stringify(record, null, 2));
}

export function loadPidInfo(cpId: string): PidInfoRecord | null {
  const filePath = getPidInfoPath(cpId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/** Scan all ~/.daemon/{cpId}/pid-info.json, return records with status='running' */
export function scanAllPidInfoRecords(): {cpId: string; record: PidInfoRecord}[] {
  const results: {cpId: string; record: PidInfoRecord}[] = [];
  if (!fs.existsSync(DAEMON_ROOT_DIR)) {
    return results;
  }
  const entries = fs.readdirSync(DAEMON_ROOT_DIR, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'sockets') {
      continue;
    }
    const cpId = entry.name;
    const record = loadPidInfo(cpId);
    if (record && record.status === 'running') {
      results.push({cpId, record});
    }
  }
  return results;
}
