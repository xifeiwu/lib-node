import path from 'path';
import {LaunchCpConfig, LaunchCpType} from '../service';
import {SpawnConfig, makeSureDirExist} from '../service/external';
import {getLogDir} from '../service';
import {LaunchCpBase, validateAndApplyStdio} from './base';

/**
 * Default stdio for detached mode:
 * stdin: ignore, stdout: ignore, stderr: ignore, ipc (needed for initial handshake)
 */
const DEFAULT_STDIO = ['ignore', 'ignore', 'ignore', 'ipc'];

/**
 * LaunchCp for detached child processes.
 * Spawns with `detached: true`, passes log file paths via infoToCp,
 * then disconnects IPC and unrefs so the parent can exit while the child keeps running.
 */
export class LaunchCpDetached extends LaunchCpBase {
  readonly type: LaunchCpType = 'detached';

  protected prepareSpawnConfig(spawnConfig: SpawnConfig): SpawnConfig {
    const logDir = getLogDir(this.id);
    makeSureDirExist(logDir);
    /** expect the child process use these file as stdout and stderr */
    const logOutPath = path.join(logDir, 'out.log');
    const logErrPath = path.join(logDir, 'err.log');

    const config = validateAndApplyStdio(spawnConfig, DEFAULT_STDIO);
    config.spawnOptions = {
      ...config.spawnOptions,
      detached: true,
    };
    config.infoToCp = {
      ...config.infoToCp,
      logOutPath,
      logErrPath,
    };
    return config;
  }

  protected afterSpawn() {
    const {childProcess} = this.cpResponse;
    if (childProcess) {
      childProcess.disconnect?.();
      childProcess.unref();
    }
  }

  async start(config?: LaunchCpConfig) {
    this.checkExistingProcess();
    this.changePhase('toStart');
    this.lastAction = 'start';
    this.retryCount = 0;
    if (config) {
      this.setConfig(config);
    }
    await this.trySpawn();
  }
}
