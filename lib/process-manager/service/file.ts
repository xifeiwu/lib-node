import fs from 'fs';
import path from 'path';
import {DAEMON_ROOT_DIR} from './external';
import {LaunchCpInfo, ResponseError} from './types';

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

export function getCpBaseDir(cpId: string): string {
  return path.join(DAEMON_ROOT_DIR, cpId);
}

export function getCpInfoPath(cpId: string): string {
  return path.join(getCpBaseDir(cpId), 'info', 'index.json');
}

export function getCpLogDir(cpId: string): string {
  return path.join(getCpBaseDir(cpId), 'log');
}

/** Prefer `info.runtime.phase`; fall back to legacy `info.status.status` from older `index.js`. */
function getLaunchCpPhase(info: LaunchCpInfo): string | undefined {
  return (
    info.runtime?.phase ??
    (info as unknown as {status?: {status?: string}}).status?.status
  );
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

/** Scan all ~/.process-manager/{cpId}/info/index.json, return those with runtime.phase === 'running' */
export function scanAllInfoRecords(): {cpId: string; info: LaunchCpInfo}[] {
  const results: {cpId: string; info: LaunchCpInfo}[] = [];
  for (const {cpId, info} of loadAllCpInfo()) {
    if (info && getLaunchCpPhase(info) === 'running') {
      results.push({cpId, info});
    }
  }
  return results;
}
