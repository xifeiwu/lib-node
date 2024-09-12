import {ChildProcess, SpawnOptions} from 'child_process';

export interface SpawnConfig {
  command: string;
  args?: ReadonlyArray<string>;
  spawnOptions?: SpawnOptions;
}

export interface InfoToCp<CpConfig = any> {
  /** Config passed to child process */
  config?: CpConfig;
  /**
   * Config for how to run child process in child process
   * Set it as Partial value as some config may be provided on child process
   */
  spawnConfig?: Partial<SpawnAndTryIpcConfig>;
}
export interface SpawnAndTryIpcConfig<CpConfig = any> extends SpawnConfig {
  waitFirstIpc?: boolean;
  infoToCp?: InfoToCp<CpConfig>;
}
export interface SpawnAndTryIpcResponse<ResponseFromCp = any> extends SpawnConfig {
  childProcess: ChildProcess;
  responseFromCp?: ResponseFromCp;
}

/**
 * An json object to describe child process related info, also remove node instance of ChildProcess as it's not Serielizeable
 */
export interface SpawnRelatedInfo<ResponseFromCp = any>
  extends SpawnConfig,
    Omit<SpawnAndTryIpcResponse<ResponseFromCp>, 'childProcess'> {
  pid: number;
}
