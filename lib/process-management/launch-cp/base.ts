import fs from 'fs';
import path from 'path';
import {spawnAndTryIpc, createRollingSnapshotWriter} from '../external';
import type {RollingSnapshotWriter} from '../external';
import {getCpDir} from '../service';
import {LaunchCpRuntime, LaunchCpConfig, LaunchCpInfo, LaunchCpType} from '../types';
import {SpawnConfig, SpawnAndTryIpcResponse} from '../external';

const phaseConvertRule: Partial<{
  [phase in LaunchCpRuntime['phase']]: Array<LaunchCpRuntime['phase']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};
export function canChangePhase(to: LaunchCpRuntime['phase'], from: LaunchCpRuntime['phase']) {
  return !phaseConvertRule[to] || phaseConvertRule[to].includes(from);
}

/**
 * Validate stdio array against default values.
 * - If stdio is not set, apply defaultStdio.
 * - If stdio is set, check each position: if both user and default specify a value
 *   and they differ, throw an error.
 */
export function validateAndApplyStdio(spawnConfig: SpawnConfig, defaultStdio: any[]): SpawnConfig {
  const config = {...spawnConfig};
  if (!config.spawnOptions) {
    config.spawnOptions = {};
  }
  config.spawnOptions = {...config.spawnOptions};
  const userStdio = config.spawnOptions.stdio;
  if (!userStdio) {
    config.spawnOptions.stdio = defaultStdio;
    return config;
  }
  if (!Array.isArray(userStdio)) {
    throw new Error(`stdio must be an array, got: ${JSON.stringify(userStdio)}`);
  }
  const stdio = [...userStdio] as any[];
  for (let i = 0; i < defaultStdio.length; i++) {
    const userVal = stdio[i];
    const defaultVal = defaultStdio[i];
    if (userVal === undefined) {
      stdio[i] = defaultVal;
    } else if (userVal !== defaultVal) {
      throw new Error(`stdio[${i}] is set to '${userVal}', but '${defaultVal}' is required for this mode`);
    }
  }
  config.spawnOptions.stdio = stdio;
  return config;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function loadInfoFromFile(filePath: string): LaunchCpInfo | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/** Remove all files in the info directory (rolling snapshots from previous runs). */
function cleanInfoDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    try {
      fs.unlinkSync(path.join(dir, entry));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Base class for child process management.
 * Handles phase state machine, spawn, and info persistence.
 */
export abstract class LaunchCpBase {
  abstract readonly type: LaunchCpType;
  config: LaunchCpConfig;
  phase: LaunchCpRuntime['phase'];
  lastAction: LaunchCpRuntime['lastAction'];
  retryCount: LaunchCpRuntime['retryCount'];
  cpResponse?: SpawnAndTryIpcResponse;
  /** The actual SpawnConfig used by spawnAndTryIpc */
  actualSpawnConfig?: SpawnConfig;
  private infoWriter?: RollingSnapshotWriter;
  constructor(config: LaunchCpConfig) {
    this.resetPhase();
    this.setConfig(config);
  }
  resetPhase() {
    this.phase = 'init';
    this.lastAction = 'none';
    this.retryCount = 0;
  }
  get id() {
    return this.config.id;
  }
  getConfig() {
    return this.config;
  }
  setConfig(config: LaunchCpConfig) {
    if (!this.config) {
      this.config = config;
    } else {
      this.config = {
        ...this.config,
        ...(config ?? {}),
      };
    }
  }
  changePhase(next: LaunchCpRuntime['phase']) {
    if (!canChangePhase(next, this.phase)) {
      throw new Error(`Can't change to phase[${next}] from phase[${this.phase}]`);
    }
    this.phase = next;
    this.persistInfo();
  }
  getInfo(): LaunchCpInfo {
    const {type, config, phase, lastAction, retryCount, cpResponse} = this;
    const info: LaunchCpInfo = {
      type,
      config,
      runtime: {
        phase,
        lastAction,
        retryCount,
        spawnConfig: this.actualSpawnConfig,
      },
    };
    if (cpResponse) {
      const {childProcess, ...rest} = cpResponse;
      info.spawnInfo = {pid: childProcess?.pid, ...rest};
    }
    return info;
  }

  private getInfoDir(): string {
    return path.join(getCpDir(this.id), 'info');
  }

  private getInfoFilePath(): string {
    return path.join(this.getInfoDir(), 'index.json');
  }

  /**
   * Check if a process with the same cpId is already running.
   * Reads the persisted info file and verifies the pid is alive.
   * @throws if a process with this cpId is already running
   */
  protected checkExistingProcess(): void {
    const info = loadInfoFromFile(this.getInfoFilePath());
    if (!info) {
      return;
    }
    const phase = info.runtime?.phase;
    const pid = info.spawnInfo?.pid;
    // if (phase === 'running' && pid && isProcessAlive(pid)) {
    if (pid && isProcessAlive(pid)) {
      throw new Error(
        `Process with id '${this.id}' is already running (pid: ${pid}). ` +
          `Stop the existing process before starting a new one.`
      );
    }
  }

  private getInfoWriter(): RollingSnapshotWriter {
    if (!this.infoWriter) {
      const dir = this.getInfoDir();
      cleanInfoDir(dir);
      this.infoWriter = createRollingSnapshotWriter({
        dir,
        basename: 'index.js',
        format: 'json',
      });
    }
    return this.infoWriter;
  }

  persistInfo() {
    this.getInfoWriter().save(this.getInfo(), err => {
      if (err) {
        console.error(`Failed to persist info for ${this.id}:`, err);
      }
    });
  }

  /** Wait for all queued info writes to flush to disk. */
  flushInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getInfoWriter().flush(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Prepare spawn config before spawning. Subclasses override to validate
   * stdio, set detached flag, etc.
   */
  protected abstract prepareSpawnConfig(spawnConfig: SpawnConfig): SpawnConfig;

  /**
   * Called after child process is spawned and running.
   * Subclasses implement this to define post-spawn behavior
   * (e.g. register exit handler + log setup, or disconnect & unref).
   */
  protected abstract afterSpawn(): void;

  async trySpawn() {
    const {config} = this;
    /** Not throw error when spawn child process and spawnConfig is null */
    if (!config || !config.spawnConfig) {
      return null;
    }
    const {spawnConfig} = config;
    this.changePhase('toSpawn');
    const prepared = this.prepareSpawnConfig(spawnConfig);
    this.actualSpawnConfig = prepared;
    this.persistInfo();
    try {
      this.cpResponse = await spawnAndTryIpc(prepared);
      const {childProcess} = this.cpResponse;
      if (childProcess) {
        this.changePhase('running');
        this.afterSpawn();
      }
      return this.cpResponse;
    } catch (err) {
      this.changePhase('exited');
    }
  }
}
