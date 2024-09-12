import {ChildProcess, SpawnOptions} from 'child_process';

/** The config will send to child process recurrsively */
export interface SpawnTsScriptConfig<CpConfig = any> {
  /** args of running child process */
  args?: string[];
  /** config for how to spawn child process */
  spawnOptions?: SpawnOptions;
  /** wait first response from child process or not, usually first response contains some info of cp */
  waitFirstResponse?: boolean;
  /** info that will send to child process */
  infoToCp?: MessageToCp<CpConfig>;
}

/**
 * Ipc message send from Main process to child process
 */
export interface MessageToCp<ConfigToCp = any> {
  /** config send to child process by ipc channel */
  config?: ConfigToCp;
  /** config to run child process in child process */
  cpConfig?: SpawnTsScriptConfig;
}

export interface ChildProcessInfo<CpResponse = any> {
  command: string;
  params: string[];
  spawnOptions: SpawnOptions;
  pid: number;
  childProcess: ChildProcess;
  childProcessResponse?: CpResponse;
}

export type ScriptFileName = 'debug-server.ts' | 'debug-server-cluster.ts' | 'customizable.ts' | 'echo-input.ts';

/**
 * Customization for child process
 * Notice: Please take care of the key order as they will be executed one by one in sequence
 */
export interface CpCustomization {
  /** delay progress of child process in ms */
  delay?: number;
  /** terminate child prcess by throw uncatch Error */
  errorMessage?: string;
  /** child process exit with exitCode after this time */
  maxLifeCycle?: number;
  exitCode?: number;
}

/** Config and Info for script debug-server.ts */
export interface DebugServerConfig {
  customization?: CpCustomization;
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
