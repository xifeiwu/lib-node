import {SpawnAndTryIpcConfig, SpawnRelatedInfo} from '../../types';

/** The config will send to child process recurrsively */
export type SpawnTsScriptConfig<CpConfig = any> = Omit<SpawnAndTryIpcConfig<CpConfig>, 'command'>;

/**
 * Ipc message send from Main process to child process
 */
// export interface MessageToCp<ConfigToCp = any> {
//   /** config send to child process by ipc channel */
//   config?: ConfigToCp;
//   /** config to run child process in child process */
//   cpConfig?: SpawnTsScriptConfig;
// }

// export interface ChildProcessInfo<CpResponse = any> {
//   command: string;
//   params: string[];
//   spawnOptions: SpawnOptions;
//   childProcess: ChildProcess;
//   childProcessResponse?: CpResponse;
// }

export type ScriptFileName =
  | 'debug-server.ts'
  | 'debug-server.js'
  | 'debug-server-cluster.ts'
  | 'echo-input.ts'
  | 'daemon.ts';

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

export interface DaemonConfig {
  /** fullname or object of path info */
  socketPath?:
    | {
        dirname: string;
        basename?: string;
      }
    | string;
}
export interface DaemonResponse {
  socketPath?: string;
  pid?: number;
}
