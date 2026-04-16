import {
  fromBuffer,
  startOneChatSocketServer,
  isObject,
  isPlainObject,
  isString,
} from '../external';
import {
  LaunchCpConfig,
  DaemonConfig,
  DaemonConnectInfo,
  Command,
  Command2Process,
  Action2Cp,
  DaemonResponse,
} from '../types';
import {getErrorResponse, serializeSocketServerInfo} from '../service';
import {Daemon} from './core';

export class DaemonSocketServer extends Daemon {
  connectInfo: DaemonConnectInfo = {};

  /**
   * If daemon run as a separate child process, it must have at least one connection channel
   */
  private async startConnectionServer() {
    const {id: daemonKey, connection} = this.config;
    const {socketConfig} = connection ?? {};
    let finalSocketConfig = socketConfig;
    /** At least start one server */
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
   * Start Daemon as child process.
   * Apart from running as child process, it can also be called in third-party process.
   */
  async startAsCp(config: DaemonConfig) {
    this.config = config;
    const {id} = this.config;
    if (!isString(id)) {
      throw new Error(`id property is not set on daemon config.`);
    }
    await this.startConnectionServer();
    await this.startAllCp();
    return this.getInfo(config.id);
  }

  getDaemonInfo() {
    const daemonInfo = super.getDaemonInfo();
    const {connectInfo} = this;
    if (connectInfo) {
      const {socket} = connectInfo;
      if (socket) {
        daemonInfo.status.connection.socket = serializeSocketServerInfo(socket);
      }
    }
    return daemonInfo;
  }

  async stopDaemon() {
    await super.stopDaemon();
    const {connectInfo} = this;
    if (connectInfo) {
      const {socket} = connectInfo;
      if (socket) {
        socket.server.close();
      }
    }
  }

  /**
   * Daemon Only: ping
   * Both Daemon and cpWrapper: info, stop
   * cpWrapper Only: start, restart
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
      const cpWrapper = this.getLaunchCp(cpConfigOrId as string);
      if (!cpWrapper) {
        throw new Error(`child process is not found for log query`);
      }
      const logData = cpWrapper.getLog();
      return {
        type: 'log',
        data: logData,
      };
    } else {
      const cpWrapper = this.getLaunchCp(cpConfigOrId);
      if (action === 'stop') {
        await this.stop(cpConfigOrId as string);
        return {
          type: 'stop',
          data: this.getInfo(cpConfigOrId as string),
        };
      } else {
        if (!cpWrapper) {
          throw new Error(`child process is not found by payload you provided.`);
        }
        const isCpConfig = isPlainObject(cpConfigOrId);
        switch (action) {
          case 'start':
            await cpWrapper.start(isCpConfig ? (cpConfigOrId as LaunchCpConfig) : undefined);
            break;
          case 'restart':
            await cpWrapper.restart(isCpConfig ? (cpConfigOrId as LaunchCpConfig) : undefined);
            break;
        }
        return {
          type: action as Action2Cp,
          data: cpWrapper.getInfo(),
        };
      }
    }
  }
}
