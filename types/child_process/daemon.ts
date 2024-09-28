import {Server} from 'net';
import {SerializableSpawnInfo, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from './common';
import {TcpServerConfig} from '../tcp';
import {SocketServerInfo} from '../net';

export namespace Daemon {
  /** Config for connection way with daemon process */
  export interface ConnectionConfig {
    socketConfig?: TcpServerConfig;
  }
  /** Extral Cp config for running on daemon process */
  export interface ExtralCpConfig {
    /** id used to identify the child process  */
    id: string | number;
    retry?: {
      /** max count of retry */
      maxCount?: number;
      /** Minimum time a child process has to be up. */
      minInterval?: number;
    };
  }
  export interface CpConfig extends SpawnAndTryIpcConfig, ExtralCpConfig {}

  export interface DaemonConfig {
    /**
     * To identify daemon process
     * If daemon run as a seperate child process, it must have at least one connection channel
     * If connection.socket is not set, daemonKey will be used as socket path
     */
    id?: string;
    /** connectionConfig should be set, as Daemon process is can't be used without communiction way */
    connection?: ConnectionConfig;
    cpConfigList?: CpConfig[];
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
  export interface ResponseInfo {
    type: ActionCommon;
    data?: DaemonInfo | CpInfo;
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
  export type DaemonResponse = ResponseInfo | ResponsePong | ResponseCpInfo | ResponseError | ResponseUnknown;
}
