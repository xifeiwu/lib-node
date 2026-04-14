import {
  fromBuffer,
  startOneChatSocketServer,
  isObject,
  isPlainObject,
  isString,
} from './external';
import {
  CpManagerConfig,
  DaemonConfig,
  DaemonConnectInfo,
  DaemonInfo,
  Command,
  Command2Process,
  Action2Cp,
  DaemonResponse,
  LogQuery,
} from './types';
import {CpManager} from './cp-manager';
import {getErrorResponse, serializeSocketServerInfo} from './service';
export class Daemon {
  config: DaemonConfig;
  connectInfo: DaemonConnectInfo = {};
  cpManagerMap: {
    [id: string]: CpManager;
  } = {};
  constructor() {}
  /**
   * If daemon run as a seperate child process, it must have at least one connection channel
   */
  private async startConnectionServer() {
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
        const command = fromBuffer(chunk, 'json') as Command;
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
  async startAsCp(config: DaemonConfig) {
    this.config = config;
    const {id, orphans} = this.config;
    if (!isString(id)) {
      throw new Error(`id property is not set on daemon config.`);
    }
    // Adopt orphan processes passed from CLI layer
    if (Array.isArray(orphans)) {
      for (const orphan of orphans) {
        const cpManager = CpManager.createOrphan(orphan.cpId, orphan.pid, id);
        this.cpManagerMap[orphan.cpId] = cpManager;
      }
    }
    await this.startConnectionServer();
    await this.startAllCp();
    return this.getInfo(config.id);
  }

  /** start one child process */
  async startCp(cpConfig: CpManagerConfig) {
    const actionStart: Command2Process = {action: 'start', data: cpConfig};
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
    const daemonInfo: DaemonInfo = {
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
  getCpManager(cpConfigOrId?: Command2Process['data']) {
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
      const {id} = cpConfigOrId as CpManagerConfig;
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
        cpManager = new CpManager(cpConfigOrId as CpManagerConfig);
        cpManager.daemonId = config.id;
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
  async handleCommand(command: Command): Promise<DaemonResponse> {
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
    } else if (action === 'log') {
      let cpId: string;
      let logOptions: {tail?: number} = {};
      if (isString(cpConfigOrId)) {
        cpId = cpConfigOrId as string;
      } else if (isPlainObject(cpConfigOrId)) {
        const query = cpConfigOrId as LogQuery;
        cpId = query.id;
        logOptions = {tail: query.tail};
      }
      const cpManager = this.getCpManager(cpId);
      if (!cpManager) {
        throw new Error(`child process is not found for log query`);
      }
      const logData = cpManager.getLog(logOptions);
      return {
        type: 'log',
        data: logData,
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
            await cpManager.start(isCpConfig ? (cpConfigOrId as CpManagerConfig) : undefined);
            break;
          case 'restart':
            await cpManager.restart(isCpConfig ? (cpConfigOrId as CpManagerConfig) : undefined);
            break;
        }
        return {
          type: action as Action2Cp,
          data: cpManager.getInfo(),
        };
      }
    }
  }
}
