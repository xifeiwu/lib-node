import fs from 'fs';
import path from 'path';
import {TcpServerInfo, DAEMON_ROOT_DIR} from './external';
import {CpInfo, CpWrapperInfo, ResponseError, SerializableCpInfo} from './types';

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

export function getProcessInfoPath(cpId: string): string {
  return path.join(getCpDir(cpId), 'info', 'index.js');
}

export function getLogOutFilePath(cpId: string, pid: number): string {
  return path.join(getCpDir(cpId), `${pid}.out`);
}

export function getLogErrorFilePath(cpId: string, pid: number): string {
  return path.join(getCpDir(cpId), `${pid}.error`);
}

export function loadInfo(cpId: string): CpWrapperInfo | null {
  const filePath = getProcessInfoPath(cpId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    delete require.cache[require.resolve(filePath)];
    return require(filePath);
  } catch {
    return null;
  }
}

/** Scan all ~/.process-management/{cpId}/info/index.js, return those with status='running' */
export function scanAllInfoRecords(): {cpId: string; info: CpWrapperInfo}[] {
  const results: {cpId: string; info: CpWrapperInfo}[] = [];
  if (!fs.existsSync(DAEMON_ROOT_DIR)) {
    return results;
  }
  const entries = fs.readdirSync(DAEMON_ROOT_DIR, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'sockets') {
      continue;
    }
    const cpId = entry.name;
    const info = loadInfo(cpId);
    if (info && info.status.status === 'running') {
      results.push({cpId, info});
    }
  }
  return results;
}
