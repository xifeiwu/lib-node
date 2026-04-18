import fs from 'fs';
import {execFileSync, execSync, spawn} from 'child_process';
import {byteToWord, isFunction, isNumber} from '../../external';
import {
  ProcessInfo,
  ProcessProps,
  ProcessFilter,
  ProcessInfoFilterFunc,
  GetProcessInfoOptions,
  PidToProcessInfo,
} from '../../types';
import {treeInfoList} from './base';

/**
 * When `rssVsizeFromPsKib`, convert `ps` memory columns to bytes: Darwin `rss` / `vsize` are documented as **1024-byte
 * units** (`man ps`). When false, {@link ProcessInfo.rss} / {@link ProcessInfo.vsize} are already bytes (Node).
 */
function withMemoryWordFields(info: ProcessInfo, rssVsizeFromPsKib: boolean): ProcessInfo {
  const rssBytes = rssVsizeFromPsKib ? info.rss * 1024 : info.rss;
  const vsizeBytes = rssVsizeFromPsKib ? info.vsize * 1024 : info.vsize;
  const toWord = (n: number) => (Number.isFinite(n) && n >= 0 ? byteToWord(n) : '');
  return {...info, rssWord: toWord(rssBytes), vsizeWord: toWord(vsizeBytes)};
}

/** Same column order as `ps -o …` for {@link getProcessInfo} / {@link getProcessInfoByPid}. */
const PS_PROPS_WITH_NUMBER: ProcessProps[] = ['pid', 'ppid', 'pgid', 'cpu', 'rss', 'vsize'];
const PS_PROPS_WITH_STRING: ProcessProps[] = ['etime', 'command'];
const PS_PROPS_COLUMNS: ProcessProps[] = [...PS_PROPS_WITH_NUMBER, ...PS_PROPS_WITH_STRING];

function assignPsProcessField(info: ProcessInfo, key: ProcessProps, value: string) {
  const row = info as unknown as Record<string, number | string>;
  if (PS_PROPS_WITH_NUMBER.includes(key)) {
    row[key as string] = Number(value);
  } else {
    row[key as string] = value;
  }
}

/** Parse `ps` stdout (header + data rows) into plain {@link ProcessInfo} rows (no `rssWord` yet). */
function parsePsStdoutToProcessRows(stdout: string): ProcessInfo[] {
  const lines = stdout.split('\n');
  return lines
    .slice(1)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const items = line.split(/\s+/);
      return PS_PROPS_COLUMNS.reduce<ProcessInfo>((sum, key, index) => {
        if (index === PS_PROPS_COLUMNS.length - 1) {
          assignPsProcessField(sum, key, items.slice(index).join(' '));
        } else {
          assignPsProcessField(sum, key, items[index]);
        }
        return sum;
      }, {} as ProcessInfo);
    })
    .filter(row => Number.isFinite(row.pid) && row.pid > 0);
}

/**
 * Linux-only: build {@link ProcessInfo} from `/proc/<pid>/{status,stat,cmdline}` (VmRSS/VmSize in kB).
 * Returns `null` if the process does not exist or cannot be read.
 */
function tryReadProcessInfoFromProcLinux(pid: number): ProcessInfo | null {
  try {
    const statusPath = `/proc/${pid}/status`;
    if (!fs.existsSync(statusPath)) {
      return null;
    }
    const status = fs.readFileSync(statusPath, 'utf8');
    const lineValue = (key: string) => {
      const m = status.match(new RegExp(`^${key}:\\s*(.+)`, 'm'));
      return m ? m[1].trim() : '';
    };
    const parseKb = (raw: string) => {
      const n = parseInt(String(raw).replace(/\s*kB$/i, ''), 10);
      return Number.isFinite(n) ? n : 0;
    };
    const ppid = parseInt(lineValue('PPid'), 10);
    if (!Number.isFinite(ppid)) {
      return null;
    }
    let pgid = 0;
    const statPath = `/proc/${pid}/stat`;
    if (fs.existsSync(statPath)) {
      const stat = fs.readFileSync(statPath, 'utf8');
      const rp = stat.indexOf(')');
      if (rp !== -1) {
        const tail = stat.slice(rp + 2).trim().split(/\s+/);
        const g = Number(tail[2]);
        if (Number.isFinite(g)) {
          pgid = g;
        }
      }
    }
    let command = '';
    const cmdlinePath = `/proc/${pid}/cmdline`;
    if (fs.existsSync(cmdlinePath)) {
      command = fs.readFileSync(cmdlinePath).toString('utf8').replace(/\0/g, ' ').trim();
    }
    return {
      pid,
      ppid,
      pgid,
      cpu: 0,
      rss: parseKb(lineValue('VmRSS')),
      vsize: parseKb(lineValue('VmSize')),
      etime: '',
      command: command || `[pid ${pid}]`,
    } as ProcessInfo;
  } catch {
    return null;
  }
}

function getProcessInfoByPidWindows(pid: number): ProcessInfo | null {
  const script = `$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}";if($null -eq $p){exit 2};@{ProcessId=$p.ProcessId;ParentProcessId=$p.ParentProcessId;CommandLine=$p.CommandLine;WorkingSetSize=[long]$p.WorkingSetSize;VirtualSize=[long]$p.VirtualSize;SessionId=[int]$p.SessionId;CreationDate=$p.CreationDate.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`;
  try {
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const o = JSON.parse(String(out).trim()) as {
      ProcessId: number;
      ParentProcessId: number;
      CommandLine: string | null;
      WorkingSetSize: number;
      VirtualSize: number;
      SessionId: number;
      CreationDate: string;
    };
    const rssKiB = Math.round(Number(o.WorkingSetSize) / 1024);
    const vsizeKiB = Math.round(Number(o.VirtualSize) / 1024);
    let etime = '';
    if (o.CreationDate) {
      const ms = Date.now() - new Date(o.CreationDate).getTime();
      if (Number.isFinite(ms) && ms >= 0) {
        etime = `${Math.floor(ms / 1000)}s`;
      }
    }
    const row = {
      pid: Number(o.ProcessId),
      ppid: Number(o.ParentProcessId),
      pgid: Number(o.SessionId) || 0,
      cpu: 0,
      rss: Number.isFinite(rssKiB) ? rssKiB : 0,
      vsize: Number.isFinite(vsizeKiB) ? vsizeKiB : 0,
      etime,
      command: o.CommandLine == null ? '' : String(o.CommandLine),
    } as ProcessInfo;
    return withMemoryWordFields(row, true);
  } catch (e: any) {
    if (e && (e.status === 2 || e.code === 2)) {
      return null;
    }
    return null;
  }
}

function getProcessInfoByPidPs(pid: number): Promise<ProcessInfo | null> {
  return new Promise(resolve => {
    const child = spawn('ps', ['-p', String(pid), '-o', PS_PROPS_COLUMNS.join(',')]);
    const bufList: Buffer[] = [];
    child.stdout.on('data', data => bufList.push(data));
    child.stderr.on('data', data => {
      console.log(`stderr: ${data}`);
    });
    child.on('error', () => resolve(null));
    child.on('close', () => {
      const rows = parsePsStdoutToProcessRows(Buffer.concat(bufList).toString());
      const row = rows.find(r => r.pid === pid) ?? rows[0];
      if (!row || !Number.isFinite(row.pid)) {
        resolve(null);
        return;
      }
      resolve(withMemoryWordFields(row, true));
    });
  });
}

export function getFilterFunc(filter?: ProcessFilter): ProcessInfoFilterFunc | null {
  if (!filter) {
    return null;
  }
  if (isFunction(filter)) {
    return filter as ProcessInfoFilterFunc;
  }
  const filterFunc: ProcessInfoFilterFunc = (current: ProcessInfo) => {
    return Object.entries(filter).every(([key, value]) => {
      if (value === undefined) {
        return true;
      }
      if ('command' === key) {
        return current[key].includes(value as string);
      } else if (isNumber(current[key])) {
        /** If type current value is number, convert target value to number */
        return Number(value) === Number(current[key]);
      }
      return value === current[key];
    });
  };
  return filterFunc;
}
/**
 * Will change on origin object, should run only once
 * @param infoList
 * @returns
 */
function toAppendChildInfo(infoList: ProcessInfo[]) {
  const pidToInfo = treeInfoList(infoList);
  for (const info of infoList) {
    const {ppid} = info;
    const pInfo = pidToInfo[ppid];
    if (!pInfo) {
      // parent id 0 not found
      // throw new Error(`parent id ${ppid} not found`);
      continue;
    }
    if (!Array.isArray(pInfo.children)) {
      pInfo.children = [];
    }
    if (pInfo.children.every(it => it.pid !== info.pid)) {
      pInfo.children.push(info);
    }
  }
  return {pidToInfo};
}

interface ProcessRelatedInfo {
  /** Rows after {@link GetProcessInfoOptions.filter}, when set; otherwise same as {@link allInfoList}. */
  infoList: ProcessInfo[];
  /** Map pid → row, only when {@link GetProcessInfoOptions.appendChildInfo} is true (includes {@link ProcessInfo.children}). */
  pidToInfo?: PidToProcessInfo;
  /** Every parsed row from `ps` before filtering. */
  allInfoList: ProcessInfo[];
}

/**
 * Spawns `ps -A -o …` on Unix, parses columns into {@link ProcessInfo}, optionally builds a parent/child tree.
 *
 * @returns All rows, filtered rows, and optional pid map. On Windows the implementation currently resolves with `null`.
 *
 * @remarks
 * Logic / robustness ideas worth considering later:
 * - Drop blank lines and rows whose `pid` is not a finite number, so filters never see half-parsed objects.
 * - BSD vs GNU `ps` differ in column flags and labels; pinning one dialect or detecting the platform avoids subtle bugs.
 * - Prefer rejecting with `Error` (and optional `cause`) instead of passing raw stderr chunks to `reject`.
 * - Align the Windows branch with the success type (e.g. empty lists) or widen the declared return type so callers do not need `null` checks.
 * - If you need stable CPU/memory semantics, confirm your `ps` flags match the intended units (KiB vs pages) for `rss` / `vsize`.
 * - **macOS Activity Monitor:** its “Memory” value is **not** `ps` RSS; it reflects different kernel accounting. {@link ProcessInfo.rssWord}
 *   is intended to match **`ps`**, not Activity Monitor. Matching AM would need Mach `task_info` (native code) or tools like `vmmap`, not `ps` alone.
 * - **Lookup by PID:** use {@link getProcessInfoByPid} instead of listing all processes. {@link getProcessInfo} still uses `ps -A` when you need filters / trees across the whole table.
 */
export async function getProcessInfo(options?: GetProcessInfoOptions): Promise<ProcessRelatedInfo> {
  const {printCommand, filter, appendChildInfo = true} = options ?? {};
  const filterFunc = getFilterFunc(filter);
  let processLister;
  if (process.platform === 'win32') {
    // win32 is not supported
    return null;
    // See also: https://github.com/nodejs/node-v0.x-archive/issues/2318
    // processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);
  } else {
    // ps -A -o 'pid,ppid,rss,vsz,pcpu,command,user,time'
    // pid:       process ID
    // ppid:      parent process ID
    // rss:       resident set size, 实际内存占用大小(单位killobytes)
    // vsz:       virtual size in Kbytes (alias vsize), 虚拟内存占用大小
    // pcup:      percentage CPU usage (alias pcpu)
    // command:   command and arguments
    // time:      user + system
    printCommand && console.log('ps', ['-A', '-o', PS_PROPS_COLUMNS.join(',')].join(' '));
    processLister = spawn('ps', ['-A', '-o', PS_PROPS_COLUMNS.join(',')]);
  }

  return new Promise<ProcessRelatedInfo>((resolve, reject) => {
    const bufList = [];
    processLister.stdout.on('data', data => {
      bufList.push(data);
    });

    processLister.stderr.on('data', data => {
      console.log(`stderr: ${data}`);
      reject(data);
    });

    /** Not sure it is better to on 'exit' or 'close' */
    processLister.on('close', code => {
      const data = Buffer.concat(bufList).toString();
      const processList = parsePsStdoutToProcessRows(data).map(row => withMemoryWordFields(row, true));

      let pidToProcessInfo: PidToProcessInfo;
      if (appendChildInfo) {
        const {pidToInfo} = toAppendChildInfo(processList);
        pidToProcessInfo = pidToInfo;
      }
      const result: ProcessRelatedInfo = {
        allInfoList: processList,
        infoList: filterFunc ? processList.filter(filterFunc) : processList,
        pidToInfo: pidToProcessInfo,
      };
      resolve(result);
    });
  });
}

/**
 * Resolves one {@link ProcessInfo} for a process ID without listing every process.
 *
 * - **Linux:** prefers `/proc/<pid>/status` (+ `stat` / `cmdline`), falls back to `ps -p`.
 * - **macOS / other Unix:** `ps -p <pid> -o …` (same columns as {@link getProcessInfo}).
 * - **Windows:** `Get-CimInstance Win32_Process` via PowerShell; `rss`/`vsize` are KiB-like values derived from byte counters to match {@link withMemoryWordFields} expectations.
 */
export async function getProcessInfoByPid(pid: number | string): Promise<ProcessInfo | null> {
  const id = typeof pid === 'string' ? Number(pid) : pid;
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  if (process.platform === 'win32') {
    return getProcessInfoByPidWindows(id);
  }
  if (process.platform === 'linux') {
    const fromProc = tryReadProcessInfoFromProcLinux(id);
    if (fromProc) {
      return withMemoryWordFields(fromProc, true);
    }
  }
  return getProcessInfoByPidPs(id);
}

export function getProcessInfoByInst(p: NodeJS.Process): ProcessInfo {
  const {pid, ppid} = process;
  return withMemoryWordFields(
    {
      pid,
      ppid,
      pgid: process.getgid(),
      etime: process.uptime() + '',
      rss: process.memoryUsage.rss(),
      cpu: 0,
      vsize: 0,
      command: process.argv.join(' '),
    } as ProcessInfo,
    false
  );
}

/**
 * Remove pid in pidList when it is child process of another pid in pidList
 * @param pidList
 * @param infoList
 */

export async function getProcessInfoByPort(port: number | string): Promise<ProcessInfo[]> {
  /**
   * > lsof -i:3005
   * COMMAND   PID    USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
   * node    72770 wuxifei   21u  IPv6 0x2464db0cd5195045      0t0  TCP *:geniuslm (LISTEN)
   */
  try {
    const output = execSync(`lsof -i:${port}`).toString();
    const lines: string[][] = output
      .split('\n')
      .slice(1)
      .map(line => {
        return line.split(/ +/);
      });
    const pidReg = /^[\d]+$/;
    const pidList: string[] = lines
      .map(it => {
        if (!Array.isArray(it)) {
          return null;
        }
        const [, pid] = it;
        if (pidReg.test(pid)) {
          return pid;
        } else {
          return null;
        }
      })
      .filter(it => Boolean(it));
    if (pidList.length === 0) {
      return [];
    }
    const {infoList} = await getProcessInfo({
      filter: it => {
        return pidList.includes(String(it.pid));
      },
    });
    return infoList;
  } catch {
    return [];
  }
}
