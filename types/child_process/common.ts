import {Server} from 'net';
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
  // spawnConfig?: Partial<SpawnAndTryIpcConfig>;
  spawnConfig?: SpawnAndTryIpcConfig;
}
export interface IpcConfig<CpConfig = any> {
  /** Info send to child process if process.send is enabled */
  infoToCp?: InfoToCp<CpConfig>;
  /**
   * Max wait time for ipc message from Child Process in unit of second
   * If maxWaitTime4Ipc is not equal undefined, main process will wait response from child process
   * until maxWaitTime4Ipc second is passed
   * Else main process will not wait for response from child process.
   */
  maxWaitTime4Ipc?: number;
}
export interface SpawnAndTryIpcConfig<CpConfig = any> extends SpawnConfig, IpcConfig<CpConfig> {}

export interface SpawnAndTryIpcResponse<ResponseFromCp = any> {
  /** original config passed */
  // config: SpawnAndTryIpcConfig;
  childProcess: ChildProcess;
  /** The time spawn event is triggered */
  spawnTime: string;
  responseFromCp?: ResponseFromCp;
}

/**
 * An json object to describe child process related info, also remove node instance of ChildProcess as it's not Serielizeable
 */
export interface SerializableSpawnInfo<ResponseFromCp = any>
  extends Omit<SpawnAndTryIpcResponse<ResponseFromCp>, 'childProcess'> {
  pid: number;
}
