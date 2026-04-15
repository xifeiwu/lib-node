import {
  killProcessByPid,
  isNumber,
  waitFor,
  get,
} from '../external';
import {CpWrapperConfig} from '../types';
import {CpWrapperBase, canChangePhase} from './base';

/**
 * CpWrapper used inside a Daemon process.
 * Handles exit retry logic, exit signals, and lifecycle management (start/stop/restart).
 */
export class CpWrapperWithDaemon extends CpWrapperBase {
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};

  protected afterSpawn() {
    this.cpResponse.childProcess.once('exit', () => {
      this.onExit();
    });
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

  async start(config?: CpWrapperConfig) {
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

  async restart(config?: CpWrapperConfig) {
    this.lastAction = 'restart';
    if (canChangePhase('toKill', this.phase)) {
      await this.stop();
    }
    await this.start(config);
  }
}
