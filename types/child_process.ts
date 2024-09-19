import {ChildProcess, SpawnOptions} from 'child_process';

export interface SpawnConfig {
  command: string;
  args?: ReadonlyArray<string>;
  spawnOptions?: SpawnOptions;
}

export interface InfoToCp<CpConfig = any> {
  /** Config passed to child process */
  config?: CpConfig;
  /**
   * Config for how to run child process in child process
   * Set it as Partial value as some config may be provided on child process
   */
  spawnConfig?: Partial<SpawnAndTryIpcConfig>;
}
export interface SpawnAndTryIpcConfig<CpConfig = any> extends SpawnConfig {
  waitFirstIpc?: boolean;
  /** Max wait time for ipc message from Child Process */
  maxWaitTime?: number;
  infoToCp?: InfoToCp<CpConfig>;
}
export interface SpawnAndTryIpcResponse<ResponseFromCp = any> extends SpawnConfig {
  childProcess: ChildProcess;
  responseFromCp?: ResponseFromCp;
}

/**
 * An json object to describe child process related info, also remove node instance of ChildProcess as it's not Serielizeable
 */
export interface SpawnRelatedInfo<ResponseFromCp = any>
  extends SpawnConfig,
    Omit<SpawnAndTryIpcResponse<ResponseFromCp>, 'childProcess'> {
  pid: number;
  fullCommand: string;
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
    slaves: Array<SpawnRelatedInfo<DebugServerResponse>>;
  }

  export interface SocketServerConfig {
    /** fullname or object of path info */
    socketPath?:
      | {
          dirname: string;
          basename?: string;
        }
      | string;
  }
  export interface SocketServerResponse {
    socketPath?: string;
    pid?: number;
  }

  export type ScriptFileName =
    | 'debug-server.ts'
    | 'debug-server.js'
    | 'debug-server-cluster.ts'
    | 'echo-input.ts'
    | 'socket-server.ts';
}
