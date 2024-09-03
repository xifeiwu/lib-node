export type ProcessProps = 'pid' | 'ppid' | 'pgid' | 'sess' | 'rss' | 'command';
export type ProcessInfo = {
  [key in ProcessProps]: string;
};

export interface ProcessInfoWithChildren extends ProcessInfo {
  children?: ProcessInfoWithChildren[];
}
