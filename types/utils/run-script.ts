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

export interface RunScriptInCPOptions<RuntimeOptions = any> {
  dryRun?: boolean;
  /** run this scritp before main script, to do some pre logic */
  preScript?: string;
  targetScript: string;
  runtimeOptions?: RuntimeOptions;
  runTargetScriptOptions?: RunTargetScriptOptions;
  spawnOptions?: SpawnOptions;
}
