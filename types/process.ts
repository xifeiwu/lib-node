export interface ProcessInfo {
  /** Operating-system process ID. */
  pid: number;
  /** Parent process ID (who spawned this process). */
  ppid: number;
  /** Process group ID (Unix `ps` pgid; see also session/process-group semantics on your OS). */
  pgid: number;
  /** CPU usage percentage as reported by `ps` (column name varies; often recent sample, not long-term average). */
  cpu: number;
  /**
   * Resident set size. From `getProcessInfo` / `ps` (e.g. Darwin): value is in **1024-byte units** (see `man ps`, keyword `rss`).
   * From `getProcessInfoByInst`: bytes (`process.memoryUsage().rss()`).
   *
   * On macOS this is **not** the same number as Activity Monitor’s “Memory” column, which uses kernel “physical footprint”
   * style accounting (compression, purgeable memory, etc.) and is often **larger** than `ps` RSS.
   */
  rss: number;
  /** Virtual memory size. From `getProcessInfo` / `ps`: typically KiB. From `getProcessInfoByInst`: may be 0. */
  vsize: number;
  /**
   * Human-readable RSS from {@link rss} via `byteToWord`. Matches **`ps` semantics**, not Activity Monitor’s Memory
   * column on macOS (see {@link rss}).
   */
  rssWord: string;
  /** Human-readable VSZ: `byteToWord` applied to byte length (see {@link vsize} for how raw values map to bytes). */
  vsizeWord: string;
  /** Elapsed time since the process started, as formatted by `ps` (string form, not normalized duration). */
  etime: string;
  /** Full command line (executable path plus arguments) as shown by `ps`. */
  command: string;
  /** Direct child processes of this row, populated when {@link GetProcessInfoOptions.appendChildInfo} is true. */
  children?: ProcessInfo[];
}
export type ProcessProps = keyof ProcessInfo;
export interface PidToProcessInfo {
  [pid: number]: ProcessInfo;
}

export type ProcessInfoFilterFunc = (info: Partial<ProcessInfo>) => boolean;
export type ProcessFilter = ProcessInfoFilterFunc | Partial<Pick<ProcessInfo, 'pid' | 'ppid' | 'command'>>;

export interface GetProcessInfoOptions {
  filter?: ProcessFilter;
  printCommand?: boolean;
  appendChildInfo?: boolean;
}
