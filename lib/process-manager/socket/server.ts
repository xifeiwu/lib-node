import {
  fromBuffer,
  startOneChatSocketServer,
  TcpServerConfig,
  TcpServerInfo,
  isObject,
  isPlainObject,
  isString,
} from '../service/external';
import {LaunchCpConfig, SocketConfig, Command, Action2Cp, DaemonResponse} from '../service';
import {getErrorResponse} from '../service';
import {Daemon} from '../launch-cp/daemon';

export class DaemonSocketServer {
  daemon: Daemon;
  private serverConfig: TcpServerConfig;
  private socketInfo?: TcpServerInfo;

  constructor(socketConfig: SocketConfig) {
    this.daemon = new Daemon(socketConfig.daemonConfig);
    this.serverConfig = socketConfig.serverConfig;
  }

  private async startConnectionServer() {
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
    this.socketInfo = await startOneChatSocketServer(handleData, this.serverConfig);
  }

  /**
   * Start daemon with socket server.
   * Can be called as a child process entry point or in a third-party process.
   */
  async start() {
    await this.startConnectionServer();
    await this.daemon.launchAllCpInConfigList();
    return this.getInfo();
  }

  getInfo(id?: string) {
    return this.daemon.getInfo(id);
  }

  async stop(id: string) {
    await this.daemon.stop(id);
  }

  async stopAll() {
    await this.daemon.stopDaemon();
    if (this.socketInfo) {
      this.socketInfo.server.close();
    }
  }

  async handleCommand(command: Command): Promise<DaemonResponse> {
    const {daemon} = this;
    const {action, data: cpConfigOrId} = command;
    if (['ping'].includes(action)) {
      switch (action) {
        case 'ping':
          return {
            type: 'pong',
            data: String(process.pid),
          };
      }
    } else if (action === 'info') {
      return {
        type: action,
        data: this.getInfo(cpConfigOrId as string),
      };
    } else {
      const cpWrapper = daemon.getLaunchCpInst(cpConfigOrId);
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
        if (isPlainObject(cpConfigOrId)) {
          cpWrapper.setConfig(cpConfigOrId as LaunchCpConfig);
        }
        switch (action) {
          case 'start':
            await cpWrapper.startInMonitoredMode();
            break;
          case 'restart':
            await cpWrapper.restart();
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
