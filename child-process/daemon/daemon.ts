import {Daemon, SocketServerInfo} from '../../types';
import {
  fromBuffer,
  isNumber,
  isObject,
  killProcessByPid,
  spawnAndTryIpc,
  startOneChatSocketServer,
  isPlainObject,
  isString,
  waitFor,
} from '../../index';
import {get} from '../../fe/utils';

const statusConvertRule: Partial<{
  [status in Daemon.CpManagerStatus['status']]: Array<Daemon.CpManagerStatus['status']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};
function canChangeToStatus(to: Daemon.CpManagerStatus['status'], from: Daemon.CpManagerStatus['status']) {
  return !statusConvertRule[to] || statusConvertRule[to].includes(from);
}
function serializeCpInfo(cpInfo: Daemon.CpInfo): Daemon.SerializableCpInfo {
  const {childProcess, ...rest} = cpInfo;
  return {
    pid: childProcess?.pid,
    ...rest,
  };
}
/**
 * Manager for one process,
 */
class CpManager {
  config: Daemon.CpManagerConfig;
  status: Daemon.CpManagerStatus['status'];
  lastAction: Daemon.CpManagerStatus['lastAction'];
  retryCount: Daemon.CpManagerStatus['retryCount'];
  cpInfo?: Daemon.CpInfo;
  cpInfoHistory?: Daemon.SerializableCpInfo[];
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};
  constructor(config: Daemon.CpManagerConfig) {
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
  setConfig(config: Daemon.CpManagerConfig) {
    if (!this.config) {
      this.config = config;
    } else {
      this.config = {
        ...this.config,
        ...(config ?? {}),
      };
    }
  }
  changeStatus(status: Daemon.CpManagerStatus['status']) {
    if (!canChangeToStatus(status, this.status)) {
      throw new Error(`Can't change to status[${status}] from status[${this.status}]`);
    }
    this.status = status;
  }
  getInfo(options?: {simple?: boolean}): Daemon.CpManagerInfo {
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
    const info: Daemon.CpManagerInfo = {
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
        this.cpInfoHistory.push(serializeCpInfo(cpInfo));
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

  async start(config?: Daemon.CpManagerConfig) {
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

  async restart(config?: Daemon.CpManagerConfig) {
    this.lastAction = 'restart';
    if (canChangeToStatus('toKill', this.status)) {
      await this.stop();
    }
    await this.start(config);
  }
}

export function getErrorResponse(err: Error | string): Daemon.ResponseError {
  let message = err as string;
  if (err instanceof Error) {
    message = err.stack ? err.stack : err.message;
  }
  const errorResponse: Daemon.ResponseError = {
    type: 'error',
    data: message,
  };
  return errorResponse;
}
function serializeSocketServerInfo(info: SocketServerInfo) {
  const {path, host, port} = info;
  if (path) {
    return {path};
  } else {
    return {host, port};
  }
}
export class CpDaemon {
  config: Daemon.DaemonConfig;
  connectInfo: Daemon.DaemonConnectStatus = {};
  cpManagerMap: {
    [id: string]: CpManager;
  } = {};
  constructor() {}
  /**
   * If daemon run as a seperate child process, it must have at least one connection channel
   */
  async startConnectionServer() {
    const {id: daemonKey, connection} = this.config;
    const {socketConfig} = connection ?? {};
    let finalSocketConfig = socketConfig;
    /** At least start on server */
    if (!socketConfig) {
      finalSocketConfig = {path: daemonKey};
    }
    /** Handle command from client, the value returned will be sent to client as response */
    const handleData = async (chunk: Buffer) => {
      try {
        const command = fromBuffer(chunk, 'json') as Daemon.Command;
        if (!isObject(command)) {
          throw new Error(`payload is not an object`);
        }
        return await this.handleCommand(command);
      } catch (err) {
        return getErrorResponse(err);
      }
    };
    const serverInfo = await startOneChatSocketServer(handleData, finalSocketConfig);
    this.connectInfo.socket = serverInfo;
  }

  /**
   * Start Daemon as child process
   * Apart run as child process, it can also be called in third-party process
   */
  async startAsCp(config: Daemon.DaemonConfig) {
    this.config = config;
    const {id} = this.config;
    if (!isString(id)) {
      throw new Error(`id property is not set on daemon config.`);
    }
    await this.startConnectionServer();
    await this.startAllCp();
    return this.getInfo(config.id);
  }

  /** start one child process */
  async startCp(cpConfig: Daemon.CpManagerConfig) {
    const actionStart: Daemon.Command2Process = {action: 'start', data: cpConfig};
    return await this.handleCommand(actionStart);
  }
  /** Start all child process configured in config */
  async startAllCp() {
    const {cpManagerConfigList: cpConfigList} = this.config;
    /** Child process should start one by one */
    if (Array.isArray(cpConfigList)) {
      for (const cpConfig of cpConfigList) {
        /** One process failure should not stop other child process startup */
        try {
          await this.startCp(cpConfig);
        } catch (err) {
          console.error(err);
        }
      }
    }
  }
  getDaemonInfo() {
    const {config, connectInfo, cpManagerMap} = this;
    const {cpManagerConfigList: cpConfigList, ...restConfig} = config ?? {};
    const daemonInfo: Daemon.DaemonInfo = {
      pid: process.pid,
      config: restConfig,
      status: {connection: {}},
      cpInfoList: Object.values(cpManagerMap).map(it => it.getInfo({simple: true})),
    };
    if (connectInfo) {
      const {socket} = connectInfo;
      if (socket) {
        daemonInfo.status.connection.socket = serializeSocketServerInfo(socket);
      }
    }
    return daemonInfo;
  }
  /**
   * Return child process if cpManager exist, else return daemon info.
   * @param id daemon id or child process id
   * @returns
   */
  getInfo(id?: string) {
    const {config, cpManagerMap} = this;
    if (id === undefined || id === config.id) {
      return this.getDaemonInfo();
    } else {
      const cpManager = cpManagerMap[id];
      if (!cpManager) {
        throw new Error(`Not found cpManager with id: ${id}`);
      }
      return cpManager.getInfo();
    }
  }
  /**
   * Stop daemon process and all it's child process it managed
   */
  async stopDaemon() {
    const {cpManagerMap, connectInfo} = this;
    for (const cpManager of Object.values(cpManagerMap)) {
      /** One process failure should not stop other child process startup */
      try {
        await cpManager.stop();
      } catch (err) {
        console.error(err);
      }
    }
    if (connectInfo) {
      const {socket} = connectInfo;
      if (socket) {
        socket.server.close();
      }
    }
  }
  /**
   * stop child process or daemon(prioritise child process), and return corresponding info
   * @param id
   * @returns
   */
  async stop(id: string) {
    const {config, cpManagerMap} = this;
    const cpManager = cpManagerMap[id];
    if (cpManager) {
      await cpManager.stop();
    } else if (id === config.id) {
      await this.stopDaemon();
    } else {
      throw new Error(`No target found by id: ${id}`);
    }
  }
  /**
   * get cpManager by config, create a new cpManager is cpConfig is passed
   * @param cpConfigOrId
   * @returns
   */
  getCpManager(cpConfigOrId?: Daemon.Command2Process['data']) {
    const {cpManagerMap, config} = this;
    let cpManager: CpManager;
    if (cpConfigOrId === undefined) {
      /**
       * if cpConfigOrId is undefined, and there is only one cpManager, return it.
       */
      const allCpManager = Object.values(cpManagerMap);
      if (allCpManager.length === 1) {
        cpManager = allCpManager[0];
      }
    } else if (isString(cpConfigOrId)) {
      /**
       * if cpConfigOrId is string, means get cpManager from cpManagerMap by this id.
       */
      cpManager = cpManagerMap[cpConfigOrId as string];
    } else if (isPlainObject(cpConfigOrId)) {
      /**
       * if cpConfigOrId is object, try find cpManager by id first
       * initialize a new instance if cpManager is not found by id.
       */
      const {id} = cpConfigOrId as Daemon.CpManagerConfig;
      if (id === undefined) {
        throw new Error(`id is undefined in cpConfig`);
      }
      /** child process key should not conflic with daemon key(if exist) */
      if (id === config.id) {
        throw new Error(`child process key is the same as daemon key`);
      }
      cpManager = cpManagerMap[id];
      // let cpManager = cpManagerMap[id];
      if (cpManager === undefined) {
        cpManager = new CpManager(cpConfigOrId as Daemon.CpManagerConfig);
        cpManagerMap[id] = cpManager;
      }
    }
    return cpManager;
  }
  /**
   * Daemon Only: ping
   * Both Daemon and cpManager: info, stop
   * cpManager Only: start, restart
   * If you want to restart Daemon, should stop and then start
   * @param command
   * @returns
   */
  async handleCommand(command: Daemon.Command): Promise<Daemon.DaemonResponse> {
    const {config} = this;
    const {action, data: cpConfigOrId} = command;
    if (['ping'].includes(action)) {
      switch (action) {
        case 'ping':
          return {
            type: 'pong',
            data: config.id,
          };
      }
    } else if (action === 'info') {
      return {
        type: action,
        data: this.getInfo(cpConfigOrId),
      };
    } else {
      const cpManager = this.getCpManager(cpConfigOrId);
      if (action === 'stop') {
        await this.stop(cpConfigOrId as string);
        return {
          type: 'stop',
          data: this.getInfo(cpConfigOrId as string),
        };
      } else {
        if (!cpManager) {
          throw new Error(`child process is not found by payload you provided.`);
        }
        const isCpConfig = isPlainObject(cpConfigOrId);
        switch (action) {
          case 'start':
            await cpManager.start(isCpConfig ? (cpConfigOrId as Daemon.CpManagerConfig) : undefined);
            break;
          case 'restart':
            await cpManager.restart(isCpConfig ? (cpConfigOrId as Daemon.CpManagerConfig) : undefined);
            break;
        }
        return {
          type: action as Daemon.Action2Cp,
          data: cpManager.getInfo(),
        };
      }
    }
  }
}
