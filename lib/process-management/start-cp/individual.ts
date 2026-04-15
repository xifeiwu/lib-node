import {CpWrapperConfig} from '../types';
import {CpWrapperBase} from './base';

/**
 * CpWrapper for standalone child processes.
 * After spawn, the child process is disconnected and unref'd so the parent can exit.
 */
export class CpWrapperIndividual extends CpWrapperBase {
  protected afterSpawn() {
    const {childProcess} = this.cpResponse;
    if (childProcess) {
      childProcess.disconnect?.();
      childProcess.unref();
    }
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
}
