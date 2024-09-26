import {Server} from 'net';
import {InfoToCp, SerializableSpawnInfo, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from './common';

export interface DaemonConfig {
  /** For socket server: fullname or object of path info */
  socketPath?:
    | {
        dirname?: string;
        basename?: string;
      }
    /** fullpath or basename */
    | string;
  /** For spwan child process: restart child process when it's exited */
  // retry?: {
  //   /** max count of retry */
  //   maxCount?: number;
  //   /** Minimum time a child process has to be up. */
  //   minInterval?: number;
  // };
}
export interface DaemonSocketInfo {
  path?: string;
  server?: Server;
}
export interface DaemonCpConfig extends SpawnAndTryIpcConfig {
  /** id used to identify the child process  */
  id: string | number;
  /** max count of retry */
  maxCount?: number;
  /** Minimum time a child process has to be up. */
  minInterval?: number;
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
export interface DaemonInfo {
  pid: number;
  config: DaemonConfig;
  socketPath: string;
  cpInfoList: DaemonCpInfo[];
}

type Action2Process = 'start' | 'stop' | 'restart';
type Action2Daemon = 'ping' | 'info';
export interface Payload2Process {
  action: Action2Process;
  data?: DaemonCpConfig;
}
export interface Payload2Daemon {
  action: Action2Daemon;
}

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
}
export interface DaemonResponseError {
  type: 'error';
  message: string;
}
export type DaemonResponseOnAction =
  | DaemonResponseDaemonInfo
  | DaemonResponsePong
  | DaemonResponseCpInfo
  | DaemonResponseError;
