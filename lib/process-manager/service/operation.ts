import fs from 'fs';
import {spawn, type ChildProcess} from 'child_process';
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

export type TailProcessLogOptions = {
  /** When aborted, tail stops and the returned promise rejects with `AbortError`. */
  signal?: AbortSignal;
  /** Lines of history before follow (same role as `tail -n`). Default 50. */
  tailLines?: number;
};

const DEFAULT_TAIL_LINES = 50;
const WAIT_LOG_MS = 60_000;
const WAIT_LOG_POLL_MS = 200;

function abortError(signal: AbortSignal): Error {
  const r = signal.reason;
  if (r instanceof Error) {
    return r;
  }
  const err = new Error(typeof r === 'string' ? r : 'Aborted');
  err.name = 'AbortError';
  return err;
}

async function waitForLogFile(filePath: string, signal?: AbortSignal): Promise<void> {
  const deadline = Date.now() + WAIT_LOG_MS;
  while (!fs.existsSync(filePath)) {
    if (signal?.aborted) {
      throw abortError(signal);
    }
    if (Date.now() > deadline) {
      throw new Error(`Timeout waiting for log file: ${filePath}`);
    }
    await new Promise(r => setTimeout(r, WAIT_LOG_POLL_MS));
  }
}

function escapePowerShellSingleQuoted(p: string): string {
  return p.replace(/'/g, "''");
}

/**
 * Stream a log file with follow semantics (`tail -n … -f`). Resolves when the tail subprocess exits.
 * If `tail` is missing on PATH (non-Windows), falls back to an in-process watcher.
 */
function tailPathFollowing(
  filePath: string,
  tailLines: number,
  out: NodeJS.WritableStream,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(abortError(signal));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let useFsFallback = false;
    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const trySpawn = (): ChildProcess => {
      if (process.platform === 'win32') {
        const lit = escapePowerShellSingleQuoted(filePath);
        return spawn(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `Get-Content -LiteralPath '${lit}' -Wait -Tail ${tailLines}`,
          ],
          {stdio: ['ignore', 'pipe', 'pipe']},
        );
      }
      return spawn('tail', ['-n', String(tailLines), '-f', filePath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    };

    const child = trySpawn();

    const onAbort = () => {
      child.kill('SIGTERM');
    };
    signal?.addEventListener('abort', onAbort, {once: true});

    child.stdout?.pipe(out);
    child.stderr?.pipe(process.stderr);

    child.once('error', (err: NodeJS.ErrnoException) => {
      signal?.removeEventListener('abort', onAbort);
      if (err.code === 'ENOENT') {
        useFsFallback = true;
        tailPathFollowingFs(filePath, tailLines, out, signal)
          .then(() => done(() => resolve()))
          .catch(e => done(() => reject(e)));
        return;
      }
      done(() => reject(err));
    });

    child.once('close', () => {
      signal?.removeEventListener('abort', onAbort);
      if (settled || useFsFallback) {
        return;
      }
      if (signal?.aborted) {
        done(() => reject(abortError(signal)));
        return;
      }
      done(() => resolve());
    });
  });
}

/**
 * Pure Node fallback when `tail` / PowerShell is unavailable (`spawn` ENOENT).
 *
 * **Phase 1 — “tail -n”:** Read only the last 256 KiB of the file (cap for huge logs), split
 * lines, print the last `tailLines` lines, then set `position` to EOF so phase 2 only sees new
 * bytes (same idea as `tail -f` after an initial snapshot).
 *
 * **Phase 2 — follow:** `readNew()` reads `[position, fileSize)` and advances `position`. Triggers:
 * `fs.watch` (may miss events on some editors/OSes) plus a 1s poll as backup.
 *
 * **Rotation:** `RollingLogWriter` can rename/truncate the file; if `stat.size < position`, treat
 * as a new file and reset `position` to 0.
 *
 * **Lifetime:** Without `signal`, the returned promise stays pending until the process exits
 * (same as leaving `tail -f` running). With `signal`, abort runs `cleanup` and rejects with
 * `AbortError`.
 */
async function tailPathFollowingFs(
  filePath: string,
  tailLines: number,
  out: NodeJS.WritableStream,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw abortError(signal);
  }
  await waitForLogFile(filePath, signal);

  // --- Phase 1: approximate `tail -n tailLines` without reading the whole file ---
  const st0 = fs.statSync(filePath);
  const readFrom = Math.max(0, st0.size - 256 * 1024);
  const initialLen = st0.size - readFrom;
  let position = st0.size;
  if (initialLen > 0) {
    const buf = Buffer.alloc(initialLen);
    const fd0 = fs.openSync(filePath, 'r');
    fs.readSync(fd0, buf, 0, initialLen, readFrom);
    fs.closeSync(fd0);
    const chunk = buf.toString('utf8');
    const lines = chunk.split(/\r?\n/);
    const tail = lines.slice(-tailLines).join('\n');
    if (tail.length > 0) {
      out.write(tail + (tail.endsWith('\n') ? '' : '\n'));
    }
  }

  // --- Phase 2: block until aborted; never resolve on “EOF” (growing log has no EOF for follow) ---
  return new Promise((_resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }

    /** Append bytes newly written after `position`; then move `position` to current EOF. */
    const readNew = () => {
      if (signal?.aborted) {
        return;
      }
      try {
        if (!fs.existsSync(filePath)) {
          return;
        }
        const st = fs.statSync(filePath);
        if (st.size < position) {
          out.write('\n[tail] log truncated or rotated; continuing from start\n');
          position = 0;
        }
        if (st.size <= position) {
          return;
        }
        const len = st.size - position;
        const buf = Buffer.alloc(len);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buf, 0, len, position);
        fs.closeSync(fd);
        out.write(buf);
        position = st.size;
      } catch {
        /* ignore transient read races (e.g. rotation) */
      }
    };

    let watcher: fs.FSWatcher;
    try {
      watcher = fs.watch(filePath, () => readNew());
    } catch (e) {
      reject(e);
      return;
    }
    readNew();
    const interval = setInterval(readNew, 1000);

    const cleanup = () => {
      clearInterval(interval);
      try {
        watcher.close();
      } catch {
        /* ignore */
      }
      signal?.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      cleanup();
      reject(abortError(signal!));
    };

    signal?.addEventListener('abort', onAbort, {once: true});
  });
}

function resolveTailOptions(options?: TailProcessLogOptions): {signal?: AbortSignal; tailLines: number} {
  return {
    signal: options?.signal,
    tailLines: options?.tailLines ?? DEFAULT_TAIL_LINES,
  };
}

export async function tailProcessOutLog(cpId: string, options?: TailProcessLogOptions): Promise<void> {
  const info = readProcInfo(cpId);
  if (!info) {
    throw new Error(`No info found for cpId: ${cpId}`);
  }
  const {signal, tailLines} = resolveTailOptions(options);
  const outFilePath = info.spawn.responseFromCp?.outFilePath ?? getProcLogOutPath(cpId);
  await waitForLogFile(outFilePath, signal);
  await tailPathFollowing(outFilePath, tailLines, process.stdout, signal);
}

export async function tailProcessErrLog(cpId: string, options?: TailProcessLogOptions): Promise<void> {
  const info = readProcInfo(cpId);
  if (!info) {
    throw new Error(`No info found for cpId: ${cpId}`);
  }
  const {signal, tailLines} = resolveTailOptions(options);
  const errFilePath = info.spawn.responseFromCp?.errFilePath ?? getProcLogErrPath(cpId);
  await waitForLogFile(errFilePath, signal);
  await tailPathFollowing(errFilePath, tailLines, process.stderr, signal);
}
