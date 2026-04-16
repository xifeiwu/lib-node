import {SpawnConfig, SerializableSpawnInfo} from '../../types/child_process/common';
import {TcpServerInfo, TcpServerConfig} from '../../types/net';

/**
 * Types for child process of Daemon
 */
export interface LaunchCpConfig {
  /** id used to identify the child process  */
  /** TODO: encodeURIComponent for id before use it as folder or file name */
  id: string;
  /** identify the cluster this process belongs to */
  clusterId?: string | number;
  retry?: {
    /** max count of retry */
    maxCount?: number;
    /** Minimum time before next spawn to make sure all resources are released for prvious cp. */
    minInterval?: number;
  };
  spawnConfig?: SpawnConfig;
}

/** Mutable runtime snapshot for one child process (lifecycle phase, last command, retries). */
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
  retryCount: number;
  /** The actual SpawnConfig used by spawnAndTryIpc (after stdio validation, detached flag, etc.) */
  spawnConfig?: SpawnConfig;
}

export type LaunchCpType = 'detached' | 'with-daemon';

/** All info of managed child process */
export interface LaunchCpInfo<ResponseFromCp = any> {
  type: LaunchCpType;
  config: LaunchCpConfig;
  runtime: LaunchCpRuntime;
  spawnInfo?: SerializableSpawnInfo<ResponseFromCp>;
}

export interface DaemonConfig {
  /**
   * To identify daemon process,
   * If daemon run as a seperate child process, it must have at least one connection channel
   * If connection.socket is not set, daemonKey will be used as socket path
   */
  id?: string;
  /** connectionConfig should be set, as Daemon process is can't be used without communiction way */
  connection?: {
    socketConfig?: TcpServerConfig;
  };
  cpWrapperConfigList?: LaunchCpConfig[];
}

export interface DaemonConnectInfo {
  socket?: TcpServerInfo;
}

export interface DaemonInfo {
  pid: number;
  config: Omit<DaemonConfig, 'cpConfigList'>;
  status: {
    connection?: {socket?: Partial<Pick<TcpServerInfo, 'host' | 'port' | 'path'>>};
  };
  cpInfoList: LaunchCpInfo[];
}

export type Action2Daemon = 'ping';
export type Action2Cp = 'start' | 'restart';
export type ActionCommon = 'info' | 'stop';
export type ActionLog = 'log';

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
export interface CommandLog {
  action: ActionLog;
  data?: string;
}
export type Command = Command2Process | Command2Daemon | CommandCommon | CommandLog;

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
