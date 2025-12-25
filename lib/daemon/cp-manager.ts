import {
  killProcessByPid,
  spawnAndTryIpc,
  isNumber,
  waitFor,
  get,
} from './external';
import { serializeCpInfo } from './service';
import {
  CpManagerStatus,
  CpInfo,
  SerializableCpInfo,
  CpManagerConfig,
  CpManagerInfo,
} from './types';

const statusConvertRule: Partial<{
  [status in CpManagerStatus['status']]: Array<CpManagerStatus['status']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};
function canChangeToStatus(to: CpManagerStatus['status'], from: CpManagerStatus['status']) {
  return !statusConvertRule[to] || statusConvertRule[to].includes(from);
}
/**
 * Manager for one process,
 */
export class CpManager {
  config: CpManagerConfig;
  status: CpManagerStatus['status'];
  lastAction: CpManagerStatus['lastAction'];
  retryCount: CpManagerStatus['retryCount'];
  cpInfo?: CpInfo;
  cpInfoHistory?: SerializableCpInfo[];
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};
  constructor(config: CpManagerConfig) {
    this.resetStatus();
    this.setConfig(config);
  }
  resetStatus() {
    this.status = 'init';
    this.lastAction = 'none';
    this.retryCount = 0;
    this.cpInfoHistory = [];
  }
  get id() {
    return this.config.id;
  }
  getConfig() {
    return this.config;
  }
  setConfig(config: CpManagerConfig) {
    if (!this.config) {
      this.config = config;
    } else {
      this.config = {
        ...this.config,
        ...(config ?? {}),
      };
    }
  }
  changeStatus(status: CpManagerStatus['status']) {
    if (!canChangeToStatus(status, this.status)) {
      throw new Error(`Can't change to status[${status}] from status[${this.status}]`);
    }
    this.status = status;
  }
  getInfo(options?: {simple?: boolean}): CpManagerInfo {
    const {simple} = options ?? {};
    const {
      id,
      config: {managerConfig, spawnConfig: spawnOptions},
      status,
      lastAction,
      retryCount,
      cpInfo,
      cpInfoHistory,
      // status: {spawnInfo, cpInfoHistory: spawnHistory, ...restStatus},
    } = this;
    const info: CpManagerInfo = {
      id,
      managerConfig: managerConfig,
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
    if (simple !== true) {
      info.cpInfoHistory = cpInfoHistory.map(serializeCpInfo);
    }
    return info;
  }

  async onExit() {
    const {config, exitSignal, cpInfo, lastAction} = this;
    const {} = config;
    this.changeStatus('onExit');
    if (cpInfo) {
      cpInfo.deadTime = new Date().toLocaleString();
    }
    const {minInterval, maxCount} = get(config, ['managerConfig', 'retry'], {});
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
    const {config, status, cpInfo} = this;
    /** Not throw erro when spawn child process and spawnConfig is null */
    if (!config || !config.spawnConfig) {
      // throw new Error(`Please provide spawnConfig`);
      return null;
    }
    const {spawnConfig: spawnOptions} = config;
    this.changeStatus('toSpawn');
    try {
      const spawnInfo = await spawnAndTryIpc(spawnOptions);
      if (cpInfo) {
        this.cpInfoHistory.unshift(serializeCpInfo(cpInfo));
      }
      this.cpInfo = {
        spawnConfig: spawnOptions,
        ...spawnInfo,
      };
      const {childProcess} = spawnInfo;
      if (childProcess) {
        this.changeStatus('running');
        childProcess.once('exit', code => {
          this.onExit();
        });
      }
      return this.cpInfo;
    } catch (err) {
      this.changeStatus('exited');
    }
  }

  async start(config?: CpManagerConfig) {
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

  async restart(config?: CpManagerConfig) {
    this.lastAction = 'restart';
    if (canChangeToStatus('toKill', this.status)) {
      await this.stop();
    }
    await this.start(config);
  }
}
