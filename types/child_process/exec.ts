import type {ExecSyncOptions} from 'child_process';

export interface ExecCmdOptions extends ExecSyncOptions {
  log?: boolean;
  ignoreStatus?: number[];
}
