export interface GetFuncNameOptions {
  funcName?: string;
  /** If there is only one exported function, run it directly */
  runTheOnlyFuncDirectly?: boolean;
  /** run script by select function exported */
  selectExportedFunc?: boolean;
}

export interface RunScriptOptions extends GetFuncNameOptions {
  funcParams?: Array<any>;
}
