import {ChildProcess, SpawnOptions} from 'child_process';

/**
 * Explain the type: string | null
 * string: we can get the value at start of logic, pass a string
 * null means we can't get the value at start, and it can be inferred from script path in later phase
 */
export interface TsNodeOptions {
  '-r'?: string | null;
  '--project'?: string | null;
  '--transpileOnly'?: boolean;
  '--swc'?: boolean;
}
interface CommonSpawnOptions {
  spawnOptions?: SpawnOptions;
  /** Only when child proces not exit or close after minUptime seconds, the spawn is considered as success */
  minUptime?: number;
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
   * @deprecated by maxWaitCpResInSec
   */
  maxWaitTime4Ipc?: number;
  /**
   * Max wait time for ipc message from Child Process, the unit is second
   * If maxWaitCpResInSec is not set, main process will not wait response from child process
   * Else main process will wait response from child process within maxWaitTime4Ipc seconds
   */
  maxWaitCpResInSec?: number;
}

interface SpawnScriptOnlyOptions<RuntimeOptions> {
  /** param for runtime */
  runtimeOptions?: RuntimeOptions;
  /** param for script */
  params?: string[];
}
/**
 * Spawn config specially for file
 * command get from file extname
 * args of SpawnConfig split into two parts: tsNodeOptions for ts-node, params for ts script
 */
export interface SpawnScriptOptions<RuntimeOptions = any, CpConfig = any>
  extends SpawnScriptOnlyOptions<RuntimeOptions>, CommonSpawnOptions, IpcConfig<CpConfig> {}

/**
 * @deprecated by SpawnScriptOptions
 */
export type SpawnFileOptions = SpawnScriptOptions;

/**
 * Configs used for node spwan function in format:
 * spawn(command, args, spawnOptions)
 */
export interface SpawnConfig<CpConfig = any> extends CommonSpawnOptions, IpcConfig<CpConfig> {
  command: string;
  /**
   * all args used for command include:
   * runtimeOptions, script path, script params
   */
  args?: ReadonlyArray<string>;
  /**
   * @deprecated as this property should be part of SpawnFileOptions
   * args are argument for command, params are for script
   */
  // params?: string[];
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
  spawnConfig?: SpawnConfig;
}

export interface SpawnAndTryIpcResponse<ResponseFromCp = any> {
  /** original config passed */
  // config: SpawnAndTryIpcConfig;
  wholeScript: string;
  childProcess: ChildProcess;
  supportIpc: boolean;
  /** The time spawn event is triggered */
  spawnTime: string;
  deadTime?: string;
  responseFromCp?: ResponseFromCp;
}

/**
 * An json object to describe child process related info, also remove node instance of ChildProcess as it's not Serielizeable
 */
export interface SerializableSpawnInfo<ResponseFromCp = any> extends Omit<
  SpawnAndTryIpcResponse<ResponseFromCp>,
  'childProcess'
> {
  pid: number;
}
