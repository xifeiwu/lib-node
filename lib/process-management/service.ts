import fs from 'fs';
import path from 'path';
import {TcpServerInfo, DAEMON_ROOT_DIR} from './external';
import {LaunchCpInfo, ResponseError} from './types';

export const MAX_WAIT_TIME_DEBUG_MODE = 120;

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

export function getLogDir(cpId: string): string {
  return path.join(getCpDir(cpId), 'log');
}

/** Prefer `info.runtime.phase`; fall back to legacy `info.status.status` from older `index.js`. */
function getLaunchCpPhase(info: LaunchCpInfo): string | undefined {
  return (
    info.runtime?.phase ??
    (info as unknown as {status?: {status?: string}}).status?.status
  );
}

export function loadInfo(cpId: string): LaunchCpInfo | null {
  const filePath = getProcessInfoPath(cpId);
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

/** Scan all ~/.process-management/{cpId}/info/index.js, return those with runtime.phase === 'running' */
export function scanAllInfoRecords(): {cpId: string; info: LaunchCpInfo}[] {
  const results: {cpId: string; info: LaunchCpInfo}[] = [];
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
    if (info && getLaunchCpPhase(info) === 'running') {
      results.push({cpId, info});
    }
  }
  return results;
}
