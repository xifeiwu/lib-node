import {Server} from 'net';
import {ChildProcess, SpawnOptions} from 'child_process';

export interface SpawnConfig {
  command: string;
  args?: ReadonlyArray<string>;
  spawnOptions?: SpawnOptions;
  /** process name */
  name?: string;
}

export interface InfoToCp<CpConfig = any> {
  /** Config passed to child process */
  config?: CpConfig;
  /**
   * Config for how to run child process in child process
   * Set it as Partial value as some config may be provided on child process
   */
  // spawnConfig?: Partial<SpawnAndTryIpcConfig>;
  spawnConfig?: SpawnAndTryIpcConfig;
}
export interface SpawnAndTryIpcConfig<CpConfig = any> extends SpawnConfig {
  /** Info send to child process if process.send is enabled */
  infoToCp?: InfoToCp<CpConfig>;
  /** Max wait time for ipc message from Child Process */
  maxWaitTime4Ipc?: number;
}
export interface SpawnAndTryIpcResponse<ResponseFromCp = any> {
  /** original config passed */
  // config: SpawnAndTryIpcConfig;
  childProcess: ChildProcess;
  /** The time spawn event is triggered */
  spawnTime: string;
  responseFromCp?: ResponseFromCp;
}

/**
 * An json object to describe child process related info, also remove node instance of ChildProcess as it's not Serielizeable
 */
export interface SerializableSpawnInfo<ResponseFromCp = any>
  extends Omit<SpawnAndTryIpcResponse<ResponseFromCp>, 'childProcess'> {
  pid: number;
}

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
          dirname: string;
          basename?: string;
        }
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
      response: SerializableSpawnInfo<ResponseFromCp>;
    };
  }

  type Action = 'start' | 'stop' | 'restart';
  export type DaemonAction = {
    action: Action | 'ping';
    info?: InfoToCp<CP.DaemonConfig>;
  };
  export interface DaemonResponseInfo {
    type: Action | 'unknown' | string;
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
