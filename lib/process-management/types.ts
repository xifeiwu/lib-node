import {SpawnConfig, SpawnAndTryIpcResponse} from '../../types/child_process/common';
import {TcpServerInfo, TcpServerConfig} from '../../types/net';

export type LogMode = 'memory' | 'file';

/**
 * Types for child process of Daemon
 */
export interface CpWrapperConfig {
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
  log?: {
    /** Log collection mode. Default: 'memory' */
    mode?: LogMode;
    /** Maximum number of lines to keep in the ring buffer (memory mode only). Default: 1000 */
    maxLines?: number;
  };
  spawnConfig?: SpawnConfig;
}

export interface CpInfo<ResponseFromCp = any> extends Partial<SpawnAndTryIpcResponse<ResponseFromCp>> {
  spawnConfig: SpawnConfig;
}
export interface SerializableCpInfo<ResponseFromCp = any> extends Omit<
  CpInfo<ResponseFromCp>,
  'childProcess'
> {
  pid: number;
}
export interface CpWrapperStatus {
  status: /** initial state */
    | 'init'
    | /** start to spawn process*/ 'toStart'
    | /** will spawn new process */ 'toSpawn'
    | /** process is running */ 'running'
    | /** process is killed */ 'toKill'
    | /** exit event is triggered */ 'onExit'
    | /** process is exited */ 'exited'
    | /** try restart process on exit */ 'toRestart';
  lastAction: 'none' | 'start' | 'stop' | 'restart';
  retryCount: number;
}

/** All info of Daemon's child process */
export interface CpWrapperInfo<ResponseFromCp = any> {
  id: CpWrapperConfig['id'];
  managerConfig?: Pick<CpWrapperConfig, 'retry' | 'log'>;
  status: CpWrapperStatus;
  cpInfo?: SerializableCpInfo<ResponseFromCp>;
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
  cpWrapperConfigList?: CpWrapperConfig[];
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
  cpInfoList: CpWrapperInfo[];
}

export type Action2Daemon = 'ping';
export type Action2Cp = 'start' | 'restart';
export type ActionCommon = 'info' | 'stop';
export type ActionLog = 'log';

export interface Command2Process {
  action: Action2Cp;
  data?: CpWrapperConfig | string;
}
export interface Command2Daemon {
  action: Action2Daemon;
  data?: any;
}
export interface CommandCommon {
  action: ActionCommon;
  data?: string;
}
export interface LogQuery {
  id?: string;
  /** Number of most recent lines to return */
  tail?: number;
}
export interface CommandLog {
  action: ActionLog;
  data?: string | LogQuery;
}
export type Command = Command2Process | Command2Daemon | CommandCommon | CommandLog;

export interface ResponseCpInfo {
  type: Action2Cp;
  data?: CpWrapperInfo;
}
export interface ResponsePong {
  type: 'pong';
  /** daemon id */
  data: string;
}
export interface ResponseInfo {
  type: ActionCommon;
  data?: DaemonInfo | CpWrapperInfo;
}
export interface ResponseLogMemory {
  type: 'log';
  data: {
    id: string;
    mode: 'memory';
    lines: string[];
    total: number;
  };
}
export interface ResponseLogFile {
  type: 'log';
  data: {
    id: string;
    mode: 'file';
    outFile: string;
    errorFile: string;
  };
}
export type ResponseLog = ResponseLogMemory | ResponseLogFile;
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
