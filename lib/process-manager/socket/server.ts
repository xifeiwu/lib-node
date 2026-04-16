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
  Action2Cp,
  DaemonResponse,
} from '../types';
import {getErrorResponse, serializeSocketServerInfo} from '../service';
import {Daemon} from '../daemon';

export class DaemonSocketServer {
  daemon: Daemon;
  connectInfo: DaemonConnectInfo = {};

  constructor(daemon?: Daemon) {
    this.daemon = daemon ?? new Daemon();
  }

  private async startConnectionServer() {
    const {id: daemonKey, connection} = this.daemon.config;
    const {socketConfig} = connection ?? {};
    let finalSocketConfig = socketConfig;
    if (!socketConfig) {
      finalSocketConfig = {path: daemonKey};
    }
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
   * Start daemon with socket server.
   * Can be called as a child process entry point or in a third-party process.
   */
  async startAsCp(config: DaemonConfig) {
    this.daemon.config = config;
    const {id} = this.daemon.config;
    if (!isString(id)) {
      throw new Error(`id property is not set on daemon config.`);
    }
    await this.startConnectionServer();
    await this.daemon.startAllCp();
    return this.getInfo(config.id);
  }

  getInfo(id?: string) {
    const daemonInfo = this.daemon.getInfo(id);
    if ('cpInfoList' in daemonInfo) {
      const {connectInfo} = this;
      if (connectInfo?.socket) {
        daemonInfo.status.connection.socket = serializeSocketServerInfo(connectInfo.socket);
      }
    }
    return daemonInfo;
  }

  async stop(id: string) {
    await this.daemon.stop(id);
  }

  async stopAll() {
    await this.daemon.stopDaemon();
    const {connectInfo} = this;
    if (connectInfo?.socket) {
      connectInfo.socket.server.close();
    }
  }

  async handleCommand(command: Command): Promise<DaemonResponse> {
    const {daemon} = this;
    const {config} = daemon;
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
        data: this.getInfo(cpConfigOrId as string),
      };
    } else if (action === 'log') {
      const cpWrapper = daemon.getLaunchCp(cpConfigOrId as string);
      if (!cpWrapper) {
        throw new Error(`child process is not found for log query`);
      }
      const logData = cpWrapper.getLog();
      return {
        type: 'log',
        data: logData,
      };
    } else {
      const cpWrapper = daemon.getLaunchCp(cpConfigOrId);
      if (action === 'stop') {
        await daemon.stop(cpConfigOrId as string);
        return {
          type: 'stop',
          data: daemon.getInfo(cpConfigOrId as string),
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
