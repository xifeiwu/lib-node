import {Server} from 'net';
import {InfoToCp, SerializableSpawnInfo, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from './common';
import {TcpServerConfig} from '../tcp';
import {SocketServerInfo} from '../net';

interface ConnectConfig {
  /** For socket server: fullname or object of path info */
  // socketPath?:
  //   | {
  //       dirname?: string;
  //       basename?: string;
  //     }
  //   /** fullpath or basename */
  //   | string;
  socketConfig?: TcpServerConfig;
  /** For spwan child process: restart child process when it's exited */
  // retry?: {
  //   /** max count of retry */
  //   maxCount?: number;
  //   /** Minimum time a child process has to be up. */
  //   minInterval?: number;
  // };
}
export interface ConnectInfo {
  socket?: SocketServerInfo;
}
export interface DaemonSocketInfo {
  path?: string;
  server?: Server;
}
export interface DaemonCpConfig extends SpawnAndTryIpcConfig {
  /** id used to identify the child process  */
  id: string | number;
  retry: {
    /** max count of retry */
    maxCount?: number;
    /** Minimum time a child process has to be up. */
    minInterval?: number;
  };
}

export interface DaemonCPStatus {
  status: 'none' | 'start' | 'running' | 'stop' | 'exit';
  currentAction: 'none' | 'start' | 'stop' | 'restart';
  retryCount: number;
  spawnInfo?: SpawnAndTryIpcResponse;
}

export interface DaemonCpInfo<ResponseFromCp = any> {
  config: DaemonCpConfig;
  status: Omit<DaemonCPStatus, 'spawnInfo'> & {
    spawnInfo?: SerializableSpawnInfo<ResponseFromCp>;
  };
}

export interface DaemonConfig {
  connectConfig?: ConnectConfig;
  cpConfig?: DaemonCpConfig;
}
export interface DaemonInfo {
  pid: number;
  config: Omit<DaemonConfig, 'cpConfig'>;
  status: {
    connect?: {socket?: Partial<Pick<SocketServerInfo, 'host' | 'port' | 'path'>>};
  };
  cpInfoList: DaemonCpInfo[];
}

export type Action2Process = 'start' | 'stop' | 'restart' | 'info';
export type Action2Daemon = 'ping' | 'info';

export interface Payload2Process {
  action: Action2Process;
  data?: DaemonCpConfig | string;
}
export interface Payload2Daemon {
  action: Action2Daemon;
  data?: any;
}
export type DaemonPayload = Payload2Process | Payload2Daemon;

export interface DaemonResponseCpInfo {
  type: Action2Process;
  data?: DaemonCpInfo;
}
export interface DaemonResponseDaemonInfo {
  type: 'info';
  data?: DaemonInfo;
}
export interface DaemonResponsePong {
  type: 'pong';
  data?: string;
}
export interface DaemonResponseError {
  type: 'error';
  data: string;
}
export interface DaemonResponseUnknown {
  type: 'unknown';
  data: string;
}
export type DaemonResponseOnAction =
  | DaemonResponseDaemonInfo
  | DaemonResponsePong
  | DaemonResponseCpInfo
  | DaemonResponseError
  | DaemonResponseUnknown;
