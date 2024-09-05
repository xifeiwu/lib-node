export type ProcessInfo = {
  pid: number;
  ppid: number;
  pgid: number;
  sess: number;
  rss: number;
  command: string;
  children?: ProcessInfo[];
};
export type ProcessProps = keyof ProcessInfo;
export interface PidToProcessInfo {
  [pid: number]: ProcessInfo;
}

export type ProcessInfoFilterFunc = (info: Partial<ProcessInfo>) => boolean;
export type ProcessFilter = ProcessInfoFilterFunc | Partial<ProcessInfo>;

export interface GetProcessInfoOptions {
  filter?: ProcessFilter;
  printCommand?: boolean;
  appendChildInfo?: boolean;
}
