import {SpawnConfig, SerializableSpawnInfo} from '../../../types/child_process/common';
import {TcpServerConfig} from '../../../types/net';

export interface InfoToCp {
  logOutPath: string;
  logErrPath: string;
}
/**
 * Types for child process of Daemon
 */
export interface LaunchCpConfig {
  /** id used to identify the child process  */
  /** TODO: encodeURIComponent for id before use it as folder or file name */
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
export interface LaunchCpInfo<ResponseFromCp = any> {
  mode: LaunchCpMode;
  config: LaunchCpConfig;
  runtime: LaunchCpRuntime;
  monitorInfo?: MonitorInfo;
  spawnInfo: SerializableSpawnInfo<ResponseFromCp>;
}

export interface LaunchCpEntry {
  cpConfig: LaunchCpConfig;
  monitorConfig?: MonitorConfig;
}

export interface DaemonConfig {
  launchCpConfigList?: LaunchCpEntry[];
}

export interface SocketConfig {
  serverConfig: TcpServerConfig;
  daemonConfig: DaemonConfig;
}

export interface DaemonInfo {
  pid: number;
  config: Omit<DaemonConfig, 'cpConfigList'>;
  cpInfoList: LaunchCpInfo[];
}

export type Action2Daemon = 'ping';
export type Action2Cp = 'start' | 'restart';
export type ActionCommon = 'info' | 'stop';

export interface Command2Process {
  action: Action2Cp;
  data?: LaunchCpConfig | string;
}
export interface Command2Daemon {
  action: Action2Daemon;
  data?: any;
}
export interface CommandCommon {
  action: ActionCommon;
  data?: string;
}
export type Command = Command2Process | Command2Daemon | CommandCommon;

export interface ResponseCpInfo {
  type: Action2Cp;
  data?: LaunchCpInfo;
}
export interface ResponsePong {
  type: 'pong';
  /** daemon id */
  data: string;
}
export interface ResponseInfo {
  type: ActionCommon;
  data?: DaemonInfo | LaunchCpInfo;
}
export interface ResponseLog {
  type: 'log';
  data: {
    id: string;
    outFile: string;
    errorFile: string;
  };
}
export interface ResponseError {
  type: 'error';
  data: string;
}
export interface ResponseUnknown {
  type: 'unknown';
  data: string;
}
export type DaemonResponse =
  | ResponseInfo
  | ResponsePong
  | ResponseCpInfo
  | ResponseLog
  | ResponseError
  | ResponseUnknown;

export type CpStatusChangeListener = (event: {type: 'spawn' | 'exit'; cpId: string; pid?: number}) => void;
