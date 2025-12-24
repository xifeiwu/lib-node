import {ChildProcess, SpawnOptions} from 'child_process';

/** Existing key with a null value means should give a default value by program */
export interface TsNodeOptions {
  '-r'?: string | null;
  '--project'?: string | null;
  '--transpileOnly'?: boolean;
  '--swc'?: boolean;
}
/**
 * Spawn config specially for file
 * command get from file extname
 * args of SpawnConfig split into two parts: tsNodeOptions for ts-node, params for ts script
 */
export interface SpawnScriptOptions<RuntimeOptions = any> {
  /** param for runtime */
  runtimeOptions?: RuntimeOptions;
  /** param for script */
  params?: string[];
  spawnOptions?: SpawnOptions;
  // printCommand?: boolean;
}
/**
 * @deprecated by SpawnScriptOptions
 */
export type SpawnFileOptions = SpawnScriptOptions;

/**
 * Configs used for node spwan function in format:
 * spawn(command, args, spawnOptions)
 */
export interface SpawnConfig {
  command: string;
  /**
   * all args used for command include:
   * runtimeOptions, script path, script params
   */
  args?: ReadonlyArray<string>;
  spawnOptions?: SpawnOptions;
  /**
   * @deprecated as this property should be part of SpawnFileOptions
   * args are argument for command, params are for script
   */
  params?: string[];
}

export interface SpawnResult {
  childProcess: ChildProcess;
  spawnConfig: SpawnConfig;
  wholeScript: string;
}

/**
 * @deprecated as it meaningless
 */
export interface InfoToCp<CpConfig = any> {
  /** Config passed to child process */
  config?: CpConfig;
  /**
   * Config for how to run child process in child process
   * Set it as Partial value as some config may be provided on child process
   */
  // spawnConfig?: Partial<SpawnAndTryIpcConfig>;
  spawnConfig?: SpawnAndIpcConfig;
}

/**
 * For many cases, parent process need communication with child process by:
 * 1. send params to child process
 * 2. wait for response from child process
 */
export interface IpcConfig<CpConfig = any> {
  /** Info send to child process if process.send is enabled */
  infoToCp?: CpConfig;
  /**
   * Max wait time for ipc message from Child Process, the unit is second
   * If maxWaitTime4Ipc is not equal undefined, main process will wait response from child process
   * until maxWaitTime4Ipc second is passed
   * Else main process will not wait for response from child process.
   */
  maxWaitTime4Ipc?: number;
}

/**
 * Do a communication by IpcConfig during spwan process
 */
export interface SpawnAndIpcConfig<CpConfig = any> extends SpawnConfig, IpcConfig<CpConfig> {}

export interface SpawnAndTryIpcResponse<ResponseFromCp = any> {
  /** original config passed */
  // config: SpawnAndTryIpcConfig;
  childProcess: ChildProcess;
  /** The time spawn event is triggered */
  spawnTime: string;
  deadTime?: string;
  responseFromCp?: ResponseFromCp;
}

/**
 * An json object to describe child process related info, also remove node instance of ChildProcess as it's not Serielizeable
 */
export interface SerializableSpawnInfo<ResponseFromCp = any>
  extends Omit<SpawnAndTryIpcResponse<ResponseFromCp>, 'childProcess'> {
  pid: number;
}
