import {SpawnOptions} from 'child_process';

export interface GetTargetScriptFuncNameOptions {
  funcName?: string;
  /** If there is only one exported function, run it directly */
  runTheOnlyFuncDirectly?: boolean;
}

export interface RunTargetScriptOptions extends GetTargetScriptFuncNameOptions {
  /** select and run exported function from script file */
  runExportedFunc?: boolean;
  funcParams?: Array<any>;
}

export interface SpawnCpWrapScriptOptions<RuntimeOptions = any> {
  dryRun?: boolean;
  targetScript: string;
  runtimeOptions?: RuntimeOptions;
  spawnOptions?: SpawnOptions;
}

export interface CpWrapScriptOptions {
  /** run this scritp before main script, to do some pre logic, such as select and set global env */
  preScript?: string;
  targetScript: string;
  runTargetScriptOptions?: RunTargetScriptOptions;
}

export type RunScriptInCPOptions<RuntimeOptions = any> = SpawnCpWrapScriptOptions<RuntimeOptions> &
  CpWrapScriptOptions;
