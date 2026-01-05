import {SpawnOptions} from 'child_process';
import {TsNodeOptions} from '../child_process';

export interface GetFuncNameOptions {
  funcName?: string;
  /** If there is only one exported function, run it directly */
  runTheOnlyFuncDirectly?: boolean;
}

export interface RunScriptOptions extends GetFuncNameOptions {
  /** run script by select function exported */
  selectExportedFunc?: boolean;
  funcParams?: Array<any>;
}

export interface RunScriptInCPOptions {
  spawnOptions?: SpawnOptions;
  tsNodeOptions?: TsNodeOptions;
  dryRun?: boolean;
  /** run this scritp before main script, to do some pre logic */
  preScript?: string;
  runScriptOptions?: RunScriptOptions;
}

// [scriptPath, RunScriptExportOptions]
export type RunScriptParams = [string, RunScriptOptions];
