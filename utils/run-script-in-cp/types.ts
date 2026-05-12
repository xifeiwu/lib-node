export interface GetTargetScriptFuncNameOptions {
  funcName?: string;
  /** If there is only one exported function, run it directly */
  runTheOnlyFuncDirectly?: boolean;
}

/**
 * How to run target script on node runtime or cp-wrapper-script
 */
export interface RunTargetScriptOptions extends GetTargetScriptFuncNameOptions {
  /** select and run exported function from script file */
  runExportedFunc?: boolean;
  funcParams?: Array<any>;
}

export interface NodeCpWrapScriptOptions {
  /** run this scritp before main script, to do some pre logic, such as select and set global env */
  preScript?: string;
  runTargetScriptOptions?: RunTargetScriptOptions;
}
