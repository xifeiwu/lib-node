import {SerializableSpawnInfo, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from './common';
import {TcpServerConfig} from '../tcp';
import {SocketServerInfo} from '../net';

/**
 * Types for child process of Daemon
 */
export namespace Daemon {
  /** Extral Cp config for running on daemon process */
  interface DaemonCpConfig {
    /** id used to identify the child process  */
    id: string;
    retry?: {
      /** max count of retry */
      maxCount?: number;
      /** Minimum time before next spawn to make sure all resources are released for prvious cp. */
      minInterval?: number;
    };
  }
  /** Config for child process of Daemon process */
  export interface CpConfig extends SpawnAndTryIpcConfig, DaemonCpConfig {}

  export interface CpStatus {
    status: /** initial state */ 'none' | 'start' | 'running' | 'stop' | 'exit';
    lastAction: 'none' | 'start' | 'stop' | 'restart';
    retryCount: number;
    lastSpawnTime?: number;
    spawnInfo?: SpawnAndTryIpcResponse;
    spawnHistory?: SpawnAndTryIpcResponse[];
  }

  /** All info of Daemon's child process */
  export interface CpInfo<ResponseFromCp = any> {
    config: CpConfig;
    status: Omit<CpStatus, 'spawnInfo' | 'spawnHistory'> & {
      spawnInfo?: SerializableSpawnInfo<ResponseFromCp>;
      spawnHistory?: SerializableSpawnInfo<ResponseFromCp>[];
    };
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
    cpConfigList?: CpConfig[];
  }

  export interface DaemonConnectStatus {
    socket?: SocketServerInfo;
  }

  export interface DaemonInfo {
    pid: number;
    config: DaemonConfig;
    status: {
      connection?: {socket?: Partial<Pick<SocketServerInfo, 'host' | 'port' | 'path'>>};
    };
    cpList: CpInfo[];
  }

  export type Action2Cp = 'start' | 'restart';
  export type Action2Daemon = 'ping';
  export type ActionCommon = 'info' | 'stop';

  export interface Command2Process {
    action: Action2Cp;
    data?: CpConfig | string;
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
    data?: CpInfo;
  }
  export interface ResponsePong {
    type: 'pong';
    /** daemon id */
    data: string;
  }
  export interface ResponseInfo {
    type: ActionCommon;
    data?: DaemonInfo | CpInfo;
  }
  export interface ResponseError {
    type: 'error';
    data: string;
  }
  export interface ResponseUnknown {
    type: 'unknown';
    data: string;
  }
  export type DaemonResponse = ResponseInfo | ResponsePong | ResponseCpInfo | ResponseError | ResponseUnknown;
}
