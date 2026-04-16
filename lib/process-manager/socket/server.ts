import {
  fromBuffer,
  startOneChatSocketServer,
  TcpServerConfig,
  TcpServerInfo,
  isObject,
  isPlainObject,
  isString,
} from '../external';
import {
  LaunchCpConfig,
  SocketConfig,
  Command,
  Action2Cp,
  DaemonResponse,
} from '../types';
import {DEFAULT_CLUSTER_ID, getErrorResponse} from '../service';
import {Daemon} from '../daemon';

export class DaemonSocketServer {
  daemon: Daemon;
  private serverConfig: TcpServerConfig;
  private socketInfo?: TcpServerInfo;

  constructor(daemon?: Daemon) {
    this.daemon = daemon ?? new Daemon();
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
  async startAsCp(socketConfig: SocketConfig) {
    const {serverConfig, daemonConfig} = socketConfig;
    this.daemon.config = daemonConfig;
    this.serverConfig = serverConfig;
    await this.startConnectionServer();
    await this.daemon.startAllCp();
    const clusterId = daemonConfig.clusterId ?? DEFAULT_CLUSTER_ID;
    return this.getInfo(clusterId);
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
    const {config} = daemon;
    const {action, data: cpConfigOrId} = command;
    if (['ping'].includes(action)) {
      switch (action) {
        case 'ping':
          return {
            type: 'pong',
            data: config.clusterId ?? DEFAULT_CLUSTER_ID,
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
