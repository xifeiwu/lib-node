import {Daemon, SocketServerInfo} from '../../types';
import {
  fromBuffer,
  isNumber,
  isObject,
  killProcessByPid,
  spawnAndTryIpc,
  serializeSpawnResponse,
  startOneChatSocketServer,
  isPlainObject,
  isString,
} from '../../index';

/**
 * Manager for one process,
 */
class CpManager {
  cpConfig: Daemon.CpConfig;
  cpStatus: Daemon.CpStatus;
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};
  constructor(cpConfig: Daemon.CpConfig) {
    this.cpStatus = this.getDefaultCpStatus();
    this.cpConfig = cpConfig;
  }
  getDefaultCpStatus(): Daemon.CpStatus {
    return {
      status: 'none',
      currentAction: 'none',
      retryCount: 0,
    };
  }
  get id() {
    return this.cpConfig.id;
  }
  getConfig() {
    return this.cpConfig;
  }
  getStatus() {
    return this.cpStatus;
  }
  getInfo(): Daemon.CpInfo {
    const {
      cpConfig,
      cpStatus: {spawnInfo, ...restStatus},
    } = this;

    return {
      config: cpConfig,
      status: {
        ...restStatus,
        spawnInfo: serializeSpawnResponse(spawnInfo),
      },
    };
  }

  async onExit() {
    const {cpConfig, cpStatus, exitSignal} = this;
    const {spawnInfo, currentAction} = cpStatus;
    const {} = cpConfig;
    cpStatus.status = 'exit';
    const {retry = {}} = cpConfig;
    const {spawnTime} = spawnInfo ?? {};
    // const {status, nextAction} = cpInfo.status;
    const {minInterval, maxCount} = retry;
    let delay = 0;
    if (isNumber(minInterval)) {
      delay = minInterval - (Date.now() - new Date(spawnTime).getTime());
    }
    function letChildDie() {
      cpStatus.status = 'none';
      if (exitSignal.resolve) {
        exitSignal.resolve();
      }
    }
    async function restartChild() {
      await new Promise(res => {
        process.nextTick(res);
      });
      await this.trySpawn();
      cpStatus.retryCount++;
    }
    if (currentAction === 'stop' || currentAction === 'restart') {
      letChildDie();
    } else if (currentAction === 'start') {
      if (isNumber(maxCount) && cpStatus.retryCount < maxCount) {
        if (delay > 0) {
          setTimeout(restartChild, delay);
        } else {
          restartChild();
        }
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
    const {cpConfig, cpStatus} = this;
    /** Not throw erro when spawn child process and spawnConfig is null */
    if (!cpConfig) {
      // throw new Error(`Please provide spawnConfig`);
      return null;
    }
    // Only can start new cp when cp status is not equal 'none'
    if (cpStatus.status !== 'none') {
      throw new Error(`We can't start child process in this status: ${cpStatus.status}`);
    }
    const cpInfo = await spawnAndTryIpc(cpConfig);
    const {childProcess} = cpInfo;
    childProcess.once('exit', code => {
      this.onExit();
    });
    return cpInfo;
  }

  async start(cpConfig?: Daemon.CpConfig) {
    const {cpStatus} = this;
    if (cpStatus.status === 'running') {
      throw new Error(`Can't start child process when it's running`);
    }
    if (cpConfig) {
      this.cpConfig === cpConfig;
    }
    const cpInfo = await this.trySpawn();
    if (cpInfo) {
      cpStatus.status = 'running';
      cpStatus.spawnInfo = cpInfo;
      cpStatus.currentAction = 'start';
      cpStatus.retryCount = 0;
    }
  }

  async stop() {
    const {cpStatus} = this;
    if (cpStatus.status !== 'running') {
      throw new Error(`Child process is not running, it's in status is: ${cpStatus.status}`);
    }
    const {spawnInfo} = cpStatus;
    if (!spawnInfo) {
      throw new Error(`cpInfo is null`);
    }
    const {childProcess} = spawnInfo;
    if (!childProcess) {
      throw new Error(`childProcess is null`);
    }
    await killProcessByPid([childProcess.pid]);
    /** change status after killProcessByPid success */
    cpStatus.status = 'stop';
    cpStatus.currentAction = 'stop';
    await this.waitExitComplete();
  }

  async restart(cpConfig?: Daemon.CpConfig) {
    const {cpStatus} = this;
    cpStatus.currentAction = 'restart';
    if (cpStatus.status === 'running') {
      await this.stop();
    }
    await this.start(cpConfig);
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
    const serverInfo = await startOneChatSocketServer(async chunk => {
      try {
        const command = fromBuffer(chunk, 'json') as Daemon.Command;
        if (!isObject(command)) {
          throw new Error(`payload is not an object`);
        }
        return await this.handleCommand(command);
      } catch (err) {
        return getErrorResponse(err);
      }
    }, finalSocketConfig);
    this.connectInfo.socket = serverInfo;
  }

  /**
   * Start Daemon as child process
   * Apart run as child process, it can also be called in third-party process
   */
  async startAsCp(config: Daemon.DaemonConfig) {
    this.config = config;
    const {id: daemonKey} = this.config;
    if (!isString(daemonKey)) {
      throw new Error(`daemonKey is not passed`);
    }
    await this.startConnectionServer();
    await this.startAllCp();
    return this.getInfo(config.id);
  }

  /** start one child process */
  async startCp(cpConfig: Daemon.CpConfig) {
    const actionStart: Daemon.Command2Process = {action: 'start', data: cpConfig};
    return await this.handleCommand(actionStart);
  }
  /** Start all child process configured in config */
  async startAllCp() {
    const {cpConfigList} = this.config;
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
  /**
   * Stop all child process and daemon process
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
  getDaemonInfo() {
    const {config, connectInfo, cpManagerMap} = this;
    const daemonInfo: Daemon.DaemonInfo = {
      pid: process.pid,
      config: config,
      status: {connection: {}},
      cpList: Object.values(cpManagerMap).map(it => it.getInfo()),
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
   * Get child process or daemon info, prioritise child process
   * @param id daemon id or child process id
   * @returns
   */
  getInfo(id: string) {
    const {config, cpManagerMap} = this;
    const cpManager = cpManagerMap[id];
    if (cpManager) {
      return cpManager.getInfo();
    } else if (id === config.id) {
      return this.getDaemonInfo();
    }
    throw new Error(`No target found by id: ${id}`);
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
      cpManager = cpManagerMap[cpConfigOrId];
    } else if (isPlainObject(cpConfigOrId)) {
      /**
       * if cpConfigOrId is object, try find cpManager by id first
       * initialize a new instance if cpManager is not found by id.
       */
      const {id} = cpConfigOrId as Daemon.CpConfig;
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
        cpManager = new CpManager(cpConfigOrId);
        cpManagerMap[id] = cpManager;
      }
    }
    return cpManager;
  }
  async handleCommand(command: Daemon.Command): Promise<Daemon.DaemonResponse> {
    const {action, data: cpConfigOrId} = command;
    if (['ping'].includes(action)) {
      switch (action) {
        case 'ping':
          return {
            type: 'pong',
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
        const isCpConfig = !isString(cpConfigOrId);
        switch (action) {
          case 'start':
            await cpManager.start(isCpConfig ? cpConfigOrId : undefined);
            break;
          case 'restart':
            await cpManager.restart(isCpConfig ? cpConfigOrId : undefined);
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
