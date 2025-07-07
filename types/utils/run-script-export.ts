export interface GetFuncNameOptions {
  funcName?: string;
  /** If there is only one exported function, run it directly */
  runTheOnlyFuncDirectly?: boolean;
}

export interface RunScriptExportOptions extends GetFuncNameOptions {
  funcParams?: Array<any>;
}
