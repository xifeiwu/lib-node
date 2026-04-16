import {Readable} from 'stream';
import {
  killProcessByPid,
  isNumber,
  waitFor,
  get,
  createRollingLogWriter,
} from '../external';
import type {RollingLogWriter} from '../external';
import {getLogDir} from '../service';
import {LaunchCpConfig, LaunchCpType, ResponseLog} from '../types';
import {SpawnConfig} from '../external';
import {LaunchCpBase, canChangePhase, validateAndApplyStdio} from './base';

/**
 * Default stdio for with-daemon mode:
 * stdin: ignore, stdout: pipe (for log collection), stderr: pipe (for log collection), ipc
 */
const DEFAULT_STDIO = ['ignore', 'pipe', 'pipe', 'ipc'];

/**
 * LaunchCp used inside a Daemon process.
 * Handles log collection, exit retry logic, exit signals, and lifecycle management (start/stop/restart).
 */
export class LaunchCpWithDaemon extends LaunchCpBase {
  readonly type: LaunchCpType = 'with-daemon';
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};
  private logOutWriter?: RollingLogWriter;
  private logErrWriter?: RollingLogWriter;

  protected prepareSpawnConfig(spawnConfig: SpawnConfig): SpawnConfig {
    return validateAndApplyStdio(spawnConfig, DEFAULT_STDIO);
  }

  protected afterSpawn() {
    const {childProcess} = this.cpResponse;
    this.setupLogFile(childProcess.stdout, childProcess.stderr);
    childProcess.once('exit', () => {
      this.onExit();
    });
  }

  private setupLogFile(stdout?: Readable, stderr?: Readable) {
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

  private cleanupLogResources() {
    if (this.logOutWriter) {
      this.logOutWriter.end();
      this.logOutWriter = undefined;
    }
    if (this.logErrWriter) {
      this.logErrWriter.end();
      this.logErrWriter = undefined;
    }
  }

  getLog(): ResponseLog['data'] {
    return {
      id: this.id,
      outFile: this.logOutWriter?.basePath ?? '',
      errorFile: this.logErrWriter?.basePath ?? '',
    };
  }

  async onExit() {
    const {config, exitSignal, cpResponse, lastAction} = this;
    this.changePhase('onExit');
    if (cpResponse) {
      cpResponse.deadTime = new Date().toLocaleString();
    }
    this.cleanupLogResources();
    const {minInterval, maxCount} = get(config, ['retry'], {});
    const letChildDie = () => {
      this.changePhase('exited');
      if (exitSignal.resolve) {
        exitSignal.resolve();
      }
    };
    const restartChild = async () => {
      this.changePhase('toRestart');
      await new Promise(res => {
        process.nextTick(res);
      });
      if (isNumber(minInterval)) {
        await waitFor(minInterval);
      }
      await this.trySpawn();
      this.retryCount++;
    };
    if (lastAction === 'stop' || lastAction === 'restart') {
      letChildDie();
    } else if (lastAction === 'start') {
      if (isNumber(maxCount) && this.retryCount < maxCount) {
        restartChild();
      } else {
        letChildDie();
      }
    } else {
      letChildDie();
    }
  }

  async waitExitComplete() {
    const {exitSignal} = this;
    return new Promise<void>((res, rej) => {
      exitSignal.resolve = res;
      exitSignal.reject = rej;
    });
  }

  async start(config?: LaunchCpConfig) {
    this.changePhase('toStart');
    this.lastAction = 'start';
    this.retryCount = 0;
    if (config) {
      this.setConfig(config);
    }
    await this.trySpawn();
  }

  async stop() {
    const {cpResponse} = this;
    if (!cpResponse) {
      throw new Error(`cpResponse is null`);
    }
    const {childProcess} = cpResponse;
    if (!childProcess) {
      throw new Error(`childProcess is null`);
    }
    this.changePhase('toKill');
    this.lastAction = 'stop';
    await killProcessByPid([childProcess.pid]);
    /** change status after killProcessByPid success */
    await this.waitExitComplete();
  }

  async restart(config?: LaunchCpConfig) {
    this.lastAction = 'restart';
    if (canChangePhase('toKill', this.phase)) {
      await this.stop();
    }
    await this.start(config);
  }
}
