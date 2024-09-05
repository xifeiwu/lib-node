export type ProcessInfo = {
  pid: number;
  ppid: number;
  pgid: number;
  sess: number;
  rss: number;
  command: string;
};
export type ProcessProps = keyof ProcessInfo;

export interface ProcessInfoWithChildren extends ProcessInfo {
  children?: ProcessInfoWithChildren[];
}

export type ProcessInfoFilterFunc = (info: Partial<ProcessInfo>) => boolean;
export type ProcessFilter = ProcessInfoFilterFunc | Partial<ProcessInfo>;