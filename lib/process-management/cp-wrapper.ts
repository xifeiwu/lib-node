import {Readable} from 'stream';
import fs from 'fs';
import path from 'path';
import {
  killProcessByPid,
  spawnAndTryIpc,
  isNumber,
  waitFor,
  get,
  makeSureDirExist,
  createRollingSnapshotWriter,
} from './external';
import type {RollingSnapshotWriter} from './external';
import {serializeCpInfo, getCpDir, getLogOutFilePath, getLogErrorFilePath} from './service';
import {CpWrapperStatus, CpInfo, CpWrapperConfig, CpWrapperInfo, ResponseLog} from './types';
import {SpawnConfig} from './external';

const statusConvertRule: Partial<{
  [status in CpWrapperStatus['status']]: Array<CpWrapperStatus['status']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};
function canChangeToStatus(to: CpWrapperStatus['status'], from: CpWrapperStatus['status']) {
  return !statusConvertRule[to] || statusConvertRule[to].includes(from);
}
/**
 * Manager for one process,
 */
export class CpWrapper {
  config: CpWrapperConfig;
  status: CpWrapperStatus['status'];
  lastAction: CpWrapperStatus['lastAction'];
  retryCount: CpWrapperStatus['retryCount'];
  cpInfo?: CpInfo;
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};
  private logOutStream?: fs.WriteStream;
  private logErrStream?: fs.WriteStream;
  private logOutFilePath?: string;
  private logErrFilePath?: string;
  private infoWriter?: RollingSnapshotWriter;
  constructor(config: CpWrapperConfig) {
    this.resetStatus();
    this.setConfig(config);
  }
  resetStatus() {
    this.status = 'init';
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
  changeStatus(status: CpWrapperStatus['status']) {
    if (!canChangeToStatus(status, this.status)) {
      throw new Error(`Can't change to status[${status}] from status[${this.status}]`);
    }
    this.status = status;
    this.persistInfo();
  }
  getInfo(): CpWrapperInfo {
    const {
      id,
      config: {retry, spawnConfig: spawnOptions},
      status,
      lastAction,
      retryCount,
      cpInfo,
    } = this;
    const managerConfig = retry !== undefined ? {retry} : undefined;
    const info: CpWrapperInfo = {
      id,
      managerConfig,
      status: {
        status,
        lastAction,
        retryCount,
      },
    };
    if (cpInfo) {
      info.cpInfo = serializeCpInfo(cpInfo);
    } else {
      info.cpInfo = serializeCpInfo({
        spawnConfig: spawnOptions,
      });
    }
    return info;
  }

  private setupLogFile(stdout?: Readable, stderr?: Readable) {
    const pid = this.cpInfo?.childProcess?.pid;
    if (!pid) return;
    makeSureDirExist(getCpDir(this.id));
    const outPath = getLogOutFilePath(this.id, pid);
    const errPath = getLogErrorFilePath(this.id, pid);
    this.logOutFilePath = outPath;
    this.logErrFilePath = errPath;
    if (stdout) {
      this.logOutStream = fs.createWriteStream(outPath, {flags: 'a'});
      stdout.pipe(this.logOutStream);
    }
    if (stderr) {
      this.logErrStream = fs.createWriteStream(errPath, {flags: 'a'});
      stderr.pipe(this.logErrStream);
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

  private cleanupLogResources() {
    if (this.logOutStream) {
      this.logOutStream.end();
      this.logOutStream = undefined;
    }
    if (this.logErrStream) {
      this.logErrStream.end();
      this.logErrStream = undefined;
    }
  }

  private prepareStdioForLogging(spawnConfig: SpawnConfig): SpawnConfig {
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
      outFile: this.logOutFilePath ?? '',
      errorFile: this.logErrFilePath ?? '',
    };
  }

  async onExit() {
    const {config, exitSignal, cpInfo, lastAction} = this;
    const {} = config;
    this.changeStatus('onExit');
    if (cpInfo) {
      cpInfo.deadTime = new Date().toLocaleString();
    }
    this.cleanupLogResources();
    const {minInterval, maxCount} = get(config, ['retry'], {});
    const letChildDie = () => {
      this.changeStatus('exited');
      if (exitSignal.resolve) {
        exitSignal.resolve();
      }
    };
    const restartChild = async () => {
      this.changeStatus('toRestart');
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

  async trySpawn() {
    const {config, cpInfo} = this;
    /** Not throw erro when spawn child process and spawnConfig is null */
    if (!config || !config.spawnConfig) {
      // throw new Error(`Please provide spawnConfig`);
      return null;
    }
    const {spawnConfig: spawnOptions} = config;
    this.changeStatus('toSpawn');
    const logEnabledConfig = this.prepareStdioForLogging(spawnOptions);
    try {
      const spawnInfo = await spawnAndTryIpc(logEnabledConfig);
      this.cpInfo = {
        spawnConfig: spawnOptions,
        ...spawnInfo,
      };
      const {childProcess} = spawnInfo;
      if (childProcess) {
        this.changeStatus('running');
        this.setupLogFile(childProcess.stdout, childProcess.stderr);
        childProcess.once('exit', code => {
          this.onExit();
        });
      }
      return this.cpInfo;
    } catch (err) {
      this.changeStatus('exited');
    }
  }

  async start(config?: CpWrapperConfig) {
    this.changeStatus('toStart');
    this.lastAction = 'start';
    this.retryCount = 0;
    if (config) {
      this.setConfig(config);
    }
    await this.trySpawn();
  }

  async stop() {
    const {cpInfo} = this;
    if (!cpInfo) {
      throw new Error(`cpInfo is null`);
    }
    const {childProcess} = cpInfo;
    if (!childProcess) {
      throw new Error(`childProcess is null`);
    }
    this.changeStatus('toKill');
    this.lastAction = 'stop';
    await killProcessByPid([childProcess.pid]);
    /** change status after killProcessByPid success */
    await this.waitExitComplete();
  }

  async restart(config?: CpWrapperConfig) {
    this.lastAction = 'restart';
    if (canChangeToStatus('toKill', this.status)) {
      await this.stop();
    }
    await this.start(config);
  }
}
