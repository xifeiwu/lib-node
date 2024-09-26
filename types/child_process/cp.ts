import {Server} from 'net';
import {InfoToCp, SerializableSpawnInfo, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from './common';

/**
 * Type for ts script run in child process
 */
export namespace CP {
  /** The config will send to child process recurrsively */
  export type SpawnTsScriptConfig<CpConfig = any> = Omit<SpawnAndTryIpcConfig<CpConfig>, 'command'>;

  /**
   * Customization for child process
   * Notice: Please take care of the key order as they will be executed one by one in sequence
   */
  export interface CpCustomization {
    /** delay progress of child process in ms */
    delay?: number;
    /** terminate child prcess by throw uncatch Error */
    errorMessage?: string;
    /** child process exit with exitCode after this time */
    maxLifeCycle?: number;
    exitCode?: number;
  }

  /** Config and Info for script debug-server.ts */
  export interface DebugServerConfig extends CpCustomization {
    port?: number;
  }
  export interface DebugServerResponse {
    origin: string;
    host: string;
    port: number;
  }

  /** Config and Info for script debug-server-cluster.ts */
  export interface DebugServerClusterConfig extends DebugServerConfig {
    slaveCount?: number;
  }
  export interface DebugServerClusterResponse {
    pid: number;
    master: DebugServerResponse;
    slaves: Array<SerializableSpawnInfo<DebugServerResponse>>;
  }

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
    retry?: {
      /** max count of retry */
      maxCount?: number;
      /** Minimum time a child process has to be up. */
      minInterval?: number;
    };
  }
  export interface DaemonSocketInfo {
    path?: string;
    server?: Server;
  }
  export interface DaemonCPStatus {
    status: 'none' | 'start' | 'running' | 'stop' | 'exit';
    currentAction: 'none' | 'start' | 'stop' | 'restart';
    retryCount: number;
    response?: SpawnAndTryIpcResponse;
  }
  export interface DaemonInfo<ResponseFromCp = any> {
    pid: number;
    config: InfoToCp<CP.DaemonConfig>;
    socketPath: string;
    cpStatus: Omit<DaemonCPStatus, 'response'> & {
      spawnInfo: SerializableSpawnInfo<ResponseFromCp>;
    };
  }
  type Action = 'start' | 'stop' | 'restart' | 'info';
  export type DaemonAction = {
    action: Action | 'ping';
    info?: InfoToCp<CP.DaemonConfig>;
  };
  export interface DaemonResponseInfo {
    type: Action | 'unknown';
    data?: DaemonInfo;
  }
  export interface DaemonResponsePong {
    type: 'pong';
  }
  export interface DaemonResponseError {
    type: 'error';
    message: string;
  }
  export type DaemonResponseOnAction = DaemonResponseInfo | DaemonResponsePong | DaemonResponseError;

  export type ScriptFileName =
    | 'debug-server.ts'
    | 'debug-server.js'
    | 'debug-server-cluster.ts'
    | 'echo-input.ts'
    | 'daemon.ts';
}
