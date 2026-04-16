import {Readable} from 'stream';
import path from 'path';
import {
  spawnAndTryIpc,
  createRollingSnapshotWriter,
  createRollingLogWriter,
} from '../external';
import type {RollingSnapshotWriter, RollingLogWriter} from '../external';
import {getCpDir, getLogDir} from '../service';
import {CpWrapperRuntime, CpWrapperConfig, CpWrapperInfo, ResponseLog} from '../types';
import {SpawnConfig, SpawnAndTryIpcResponse} from '../external';

const phaseConvertRule: Partial<{
  [phase in CpWrapperRuntime['phase']]: Array<CpWrapperRuntime['phase']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};
export function canChangePhase(to: CpWrapperRuntime['phase'], from: CpWrapperRuntime['phase']) {
  return !phaseConvertRule[to] || phaseConvertRule[to].includes(from);
}

/**
 * Base class for child process management.
 * Handles phase state machine, spawn, logging, and info persistence.
 */
export abstract class CpWrapperBase {
  config: CpWrapperConfig;
  phase: CpWrapperRuntime['phase'];
  lastAction: CpWrapperRuntime['lastAction'];
  retryCount: CpWrapperRuntime['retryCount'];
  cpResponse?: SpawnAndTryIpcResponse;
  private logOutWriter?: RollingLogWriter;
  private logErrWriter?: RollingLogWriter;
  private infoWriter?: RollingSnapshotWriter;
  constructor(config: CpWrapperConfig) {
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
  setConfig(config: CpWrapperConfig) {
    if (!this.config) {
      this.config = config;
    } else {
      this.config = {
        ...this.config,
        ...(config ?? {}),
      };
    }
  }
  changePhase(next: CpWrapperRuntime['phase']) {
    if (!canChangePhase(next, this.phase)) {
      throw new Error(`Can't change to phase[${next}] from phase[${this.phase}]`);
    }
    this.phase = next;
    this.persistInfo();
  }
  getInfo(): CpWrapperInfo {
    const {config, phase, lastAction, retryCount, cpResponse} = this;
    const info: CpWrapperInfo = {
      config,
      runtime: {
        phase,
        lastAction,
        retryCount,
      },
    };
    if (cpResponse) {
      const {childProcess, ...rest} = cpResponse;
      info.cpResponse = {pid: childProcess?.pid, ...rest};
    }
    return info;
  }

  protected setupLogFile(stdout?: Readable, stderr?: Readable) {
    const logDir = getLogDir(this.id);
    if (stdout) {
      this.logOutWriter = createRollingLogWriter({dir: logDir, basename: 'out.log'});
      stdout.on('data', (chunk: Buffer) => {
        this.logOutWriter.write(chunk);
      });
    }
    if (stderr) {
      this.logErrWriter = createRollingLogWriter({dir: logDir, basename: 'err.log'});
      stderr.on('data', (chunk: Buffer) => {
        this.logErrWriter.write(chunk);
      });
    }
  }

  private getInfoWriter(): RollingSnapshotWriter {
    if (!this.infoWriter) {
      this.infoWriter = createRollingSnapshotWriter({
        dir: path.join(getCpDir(this.id), 'info'),
        basename: 'index.js',
        format: 'commonjs',
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

  protected cleanupLogResources() {
    if (this.logOutWriter) {
      this.logOutWriter.end();
      this.logOutWriter = undefined;
    }
    if (this.logErrWriter) {
      this.logErrWriter.end();
      this.logErrWriter = undefined;
    }
  }

  protected prepareStdioForLogging(spawnConfig: SpawnConfig): SpawnConfig {
    const config = {...spawnConfig};
    if (!config.spawnOptions) {
      config.spawnOptions = {};
    }
    const options = {...config.spawnOptions};
    let stdio = options.stdio as any[];
    if (!Array.isArray(stdio)) {
      return config;
    }
    stdio = [...stdio];
    if (stdio[1] === 'ignore') stdio[1] = 'pipe';
    if (stdio[2] === 'ignore') stdio[2] = 'pipe';
    options.stdio = stdio;
    config.spawnOptions = options;
    return config;
  }

  getLog(): ResponseLog['data'] {
    return {
      id: this.id,
      outFile: this.logOutWriter?.basePath ?? '',
      errorFile: this.logErrWriter?.basePath ?? '',
    };
  }

  /**
   * Called after child process is spawned and running.
   * Subclasses implement this to define post-spawn behavior
   * (e.g. register exit handler, or disconnect & unref).
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
    const logEnabledConfig = this.prepareStdioForLogging(spawnConfig);
    try {
      this.cpResponse = await spawnAndTryIpc(logEnabledConfig);
      const {childProcess} = this.cpResponse;
      if (childProcess) {
        this.changePhase('running');
        this.setupLogFile(childProcess.stdout, childProcess.stderr);
        this.afterSpawn();
      }
      return this.cpResponse;
    } catch (err) {
      this.changePhase('exited');
    }
  }
}
