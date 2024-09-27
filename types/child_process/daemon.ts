import {Server} from 'net';
import {SerializableSpawnInfo, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from './common';
import {TcpServerConfig} from '../tcp';
import {SocketServerInfo} from '../net';

export namespace Daemon {
  /** Config for connection way with daemon process */
  export interface ConnectionConfig {
    socketConfig?: TcpServerConfig;
  }
  export interface CpConfig extends SpawnAndTryIpcConfig {
    /** id used to identify the child process  */
    id: string | number;
    retry: {
      /** max count of retry */
      maxCount?: number;
      /** Minimum time a child process has to be up. */
      minInterval?: number;
    };
  }

  export interface DaemonConfig {
    /** Dameon process should have a key for identification */
    daemonKey: string;
    /** connectionConfig should be set, as Daemon process is can't be used without communiction way */
    connection?: ConnectionConfig;
    cp?: CpConfig;
  }

  export interface ConnectInfo {
    socket?: SocketServerInfo;
  }

  export interface CpStatus {
    status: 'none' | 'start' | 'running' | 'stop' | 'exit';
    currentAction: 'none' | 'start' | 'stop' | 'restart';
    retryCount: number;
    spawnInfo?: SpawnAndTryIpcResponse;
  }

  export interface CpInfo<ResponseFromCp = any> {
    config: CpConfig;
    status: Omit<CpStatus, 'spawnInfo'> & {
      spawnInfo?: SerializableSpawnInfo<ResponseFromCp>;
    };
  }

  export interface DaemonInfo {
    pid: number;
    config: DaemonConfig;
    status: {
      connection?: {socket?: Partial<Pick<SocketServerInfo, 'host' | 'port' | 'path'>>};
    };
    cpList: CpInfo[];
  }

  export type Action2Cp = 'start' | 'stop' | 'restart' | 'info';
  export type Action2Daemon = 'ping' | 'info';

  export interface Command2Process {
    action: Action2Cp;
    data?: CpConfig | string;
  }
  export interface Command2Daemon {
    action: Action2Daemon;
    data?: any;
  }
  export type Command = Command2Process | Command2Daemon;

  export interface ResponseCpInfo {
    type: Action2Cp;
    data?: CpInfo;
  }
  export interface ResponseDaemonInfo {
    type: 'info';
    data?: DaemonInfo;
  }
  export interface ResponsePong {
    type: 'pong';
    data?: string;
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
    | ResponseDaemonInfo
    | ResponsePong
    | ResponseCpInfo
    | ResponseError
    | ResponseUnknown;
}
