import {SpawnConfig, SerializableSpawnInfo} from '../../../types/child_process/common';

export interface InfoToCp {
  logOutPath: string;
  logErrPath: string;
}
export interface CpResponse {
  outFilePath?: string;
  errFilePath?: string;
}

export interface LaunchCpConfig {
  /** id used to identify the child process  */
  id: string;
  spawnConfig?: SpawnConfig | string;
}

export interface MonitorConfig {
  retry?: {
    /** max count of retry */
    maxCount?: number;
    /** Minimum time before next spawn to make sure all resources are released for previous cp. */
    minInterval?: number;
  };
  logCpOut?: boolean;
}

/** Mutable runtime snapshot for one child process (lifecycle phase, last command). */
export interface LaunchCpRuntime {
  phase:
    | /** initial state */ 'init'
    | /** start to spawn process */ 'toStart'
    | /** will spawn new process */ 'toSpawn'
    | /** process is running */ 'running'
    | /** process is killed */ 'toKill'
    | /** exit event is triggered */ 'onExit'
    | /** process is exited */ 'exited'
    | /** try restart process on exit */ 'toRestart';
  lastAction: 'none' | 'start' | 'stop' | 'restart';
  /** The actual SpawnConfig used by spawnAndTryIpc (after stdio validation, detached flag, etc.) */
  spawnConfig?: SpawnConfig;
}

export interface MonitorInfo {
  /** monitor process pid */
  id: number;
  retryCount: number;
}

export type LaunchCpMode = 'detached' | 'monitored';

/** All info of managed child process */
export interface LaunchCpInfo<ResponseFromCp extends CpResponse = CpResponse> {
  mode: LaunchCpMode;
  config: LaunchCpConfig;
  runtime: LaunchCpRuntime;
  monitor?: MonitorInfo;
  spawn: SerializableSpawnInfo<ResponseFromCp>;
}

export interface LaunchCpEntry {
  cpConfig: LaunchCpConfig;
  monitorConfig?: MonitorConfig;
}
