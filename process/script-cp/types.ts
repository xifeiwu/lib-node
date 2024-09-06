import {ChildProcess, SpawnOptions} from 'child_process';

export type ScriptFileName = 'debug-server' | 'debug-server-cluster' | 'customizable' | 'echo-input';
export interface ChildProcessInfo<T = any> {
  command: string;
  params: string[];
  spawnOptions: SpawnOptions;
  pid: number;
  childProcess: ChildProcess;
  childProcessResponse?: T;
}

/** The config will send to child process recurrsively */
export interface RunTsScriptConfig<IpcMessage = any> {
  /** args of running child process */
  args?: string[];
  /** config for how to spawn child process */
  spawnOptions?: SpawnOptions;
  infoToCp?: MessageToCp<IpcMessage>;
}

/**
 * Ipc message send from Main process to child process
 */
export interface MessageToCp<IpcMessage = any> {
  /** config send to child process by ipc channel */
  config?: IpcMessage;
  /** config to run child process in child process */
  cpConfig?: RunTsScriptConfig;
}

/** Config and Info for script debug-server.ts */
export interface DebugServerConfig {
  port?: number;
}
export interface DebugServerResponse {
  origin: string;
  host: string;
  port: number;
}

/** Config and Info for script debug-server-cluster.ts */
export interface DebugServerClusterConfig extends DebugServerConfig {
  slaveCount?: number;
}
export interface DebugServerClusterResponse {
  pid: number;
  master: DebugServerResponse;
  slaves: Array<ChildProcessInfo<DebugServerResponse>>;
}
