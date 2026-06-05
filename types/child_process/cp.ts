import {SerializableSpawnInfo} from './common';
import {HttpServerConfig} from '../http';
import {ProcessInfo} from '../process';

/**
 * Type for ts script run in child process
 */
export namespace CP {
  /** The config will send to child process */
  // export type SpawnTsScriptConfig<CpConfig = any> = Omit<SpawnAndTryIpcConfig<CpConfig>, 'command'>;

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
  export interface DebugServerIpcResponse {
    serverInfo: {
      host: string;
      port: number;
      origin: string;
      config: HttpServerConfig;
    };
    processInfo: ProcessInfo;
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
}
