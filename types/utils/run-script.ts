import {SpawnOptions} from 'child_process';

export interface GetTargetScriptFuncNameOptions {
  funcName?: string;
  /** If there is only one exported function, run it directly */
  runTheOnlyFuncDirectly?: boolean;
}

/**
 * How to run target script on node runtime or cp-wrap-script
 */
export interface RunTargetScriptOptions extends GetTargetScriptFuncNameOptions {
  /** select and run exported function from script file */
  runExportedFunc?: boolean;
  funcParams?: Array<any>;
}

/**
 * Options for spawn cp-script.ts
 */
export interface SpawnCpWrapScriptOptions<RuntimeOptions = any> {
  dryRun?: boolean;
  /** path of target script to run */
  targetScript: string;
  /** options for target script runtime */
  runtimeOptions?: RuntimeOptions;
  /** options for spawn the child process */
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
