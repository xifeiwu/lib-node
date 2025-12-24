import {SpawnConfig, SpawnAndTryIpcResponse} from './common';
import {SocketServerInfo, TcpServerConfig} from '../net';

/**
 * Types for child process of Daemon
 */
export namespace Daemon {
  export interface CpManagerConfig {
    /** id used to identify the child process  */
    id: string;
    managerConfig?: {
      retry?: {
        /** max count of retry */
        maxCount?: number;
        /** Minimum time before next spawn to make sure all resources are released for prvious cp. */
        minInterval?: number;
      };
    };
    spawnConfig?: SpawnConfig;
  }

  export interface CpInfo<ResponseFromCp = any> extends Partial<SpawnAndTryIpcResponse<ResponseFromCp>> {
    spawnConfig: SpawnConfig;
  }
  export interface SerializableCpInfo<ResponseFromCp = any>
    extends Omit<CpInfo<ResponseFromCp>, 'childProcess'> {
    pid: number;
  }
  export interface CpManagerStatus {
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
  export interface CpManagerInfo<ResponseFromCp = any> {
    id: CpManagerConfig['id'];
    managerConfig: CpManagerConfig['managerConfig'];
    status: CpManagerStatus;
    cpInfo?: SerializableCpInfo<ResponseFromCp>;
    cpInfoHistory?: SerializableCpInfo<ResponseFromCp>[];
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
    cpManagerConfigList?: CpManagerConfig[];
  }

  export interface DaemonConnectStatus {
    socket?: SocketServerInfo;
  }

  export interface DaemonInfo {
    pid: number;
    config: Omit<DaemonConfig, 'cpConfigList'>;
    status: {
      connection?: {socket?: Partial<Pick<SocketServerInfo, 'host' | 'port' | 'path'>>};
    };
    cpInfoList: CpManagerInfo[];
  }

  export type Action2Daemon = 'ping';
  export type Action2Cp = 'start' | 'restart';
  export type ActionCommon = 'info' | 'stop';

  export interface Command2Process {
    action: Action2Cp;
    data?: CpManagerConfig | string;
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
    data?: CpManagerInfo;
  }
  export interface ResponsePong {
    type: 'pong';
    /** daemon id */
    data: string;
  }
  export interface ResponseInfo {
    type: ActionCommon;
    data?: DaemonInfo | CpManagerInfo;
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
