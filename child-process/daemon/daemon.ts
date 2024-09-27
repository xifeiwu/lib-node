import fs from 'fs';
import net from 'net';
import path from 'path';
import {Daemon, SocketServerInfo} from '../../types';
import {
  fromBuffer,
  isNumber,
  isObject,
  killProcessByPid,
  spawnAndTryIpc,
  serializeSpawnResponse,
  startOneChatSocketServer,
} from '../../index';
import {DAEMON_SOCKET_DIR} from '../daemon/service';
import {isString} from 'markdown-it/lib/common/utils';
import {Socket} from 'net';

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
  // async updateCpConfig(cpConfig: DaemonCpConfig, restart?: boolean) {
  //   this.cpConfig = cpConfig;
  //   if (restart) {
  //     await this.restart();
  //   }
  // }
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
      await stop();
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
  connectInfo: Daemon.ConnectInfo = {};
  cpManagerMap: {
    [id: string]: CpManager;
  } = {};
  constructor(config: Daemon.DaemonConfig) {
    this.config = config;
  }
  /**
   * If daemon run as a seperate child process, it must have at least one connection channel
   */
  async startConnectionServer() {
    const {daemonKey, connection} = this.config;
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
  async startCp(cpConfig: Daemon.CpConfig) {
    const actionStart: Daemon.Command2Process = {action: 'start', data: cpConfig};
    return await this.handleCommand(actionStart);
  }
  async start() {
    const {daemonKey, cp: cpConfig} = this.config;
    if (!isString(daemonKey)) {
      throw new Error(`daemonKey is not passed`);
    }
    const promiseList: Array<Promise<any>> = [this.startConnectionServer()];
    if (cpConfig) {
      promiseList.push(this.startCp(cpConfig));
    }
    await Promise.all(promiseList);
    return this.getInfo();
  }
  getInfo() {
    const {config, connectInfo, cpManagerMap} = this;
    const info: Daemon.DaemonInfo = {
      pid: process.pid,
      config: config,
      status: {connection: {}},
      cpList: Object.values(cpManagerMap).map(it => it.getInfo()),
    };
    if (connectInfo) {
      const {socket} = connectInfo;
      if (socket) {
        info.status.connection.socket = serializeSocketServerInfo(socket);
      }
    }
    return info;
  }
  getCpManager(cpConfigOrId?: Daemon.Command2Process['data']) {
    if (cpConfigOrId === undefined) {
      return undefined;
    }
    const {cpManagerMap} = this;
    /** return first cpManager in cpManagerMap by default */
    let cpManager = Object.values(cpManagerMap)[0];
    if (isString(cpConfigOrId)) {
      cpManager = cpManagerMap[cpConfigOrId];
    } else {
      const {id} = cpConfigOrId as Daemon.CpConfig;
      if (id === undefined) {
        throw new Error(`id is undefined in cpConfig`);
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
    const cpManager = this.getCpManager(cpConfigOrId);
    if (['ping'].includes(action)) {
      switch (action) {
        case 'ping':
          return {
            type: 'pong',
          };
      }
    } else if (action === 'info') {
      if (cpManager) {
        return {
          type: action,
          data: cpManager.getInfo(),
        };
      } else {
        return {
          type: action,
          data: this.getInfo(),
        };
      }
    } else {
      if (!cpManager) {
        throw new Error(`child process is not found by payload you provided.`);
      }
      const isCpConfig = !isString(cpConfigOrId);
      switch (action) {
        case 'stop':
          await cpManager.stop();
        case 'start':
          await cpManager.start(isCpConfig ? cpConfigOrId : undefined);
        case 'restart':
          await cpManager.restart(isCpConfig ? cpConfigOrId : undefined);
      }
      // if (action === 'info' && cpManager)
      return {
        type: action as Daemon.Action2Cp,
        data: cpManager.getInfo(),
      };
    }
  }
}
