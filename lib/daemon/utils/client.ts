import {NetConnectOpts} from 'net';
import {oneChatFromSocketClient} from '../external';
import {Command2Daemon, CommandCommon, Command2Process, CommandLog, LogQuery} from '../types';

export class SocketClientToDaemon {
  connectOpts: NetConnectOpts;
  constructor(connectOpts: NetConnectOpts) {
    this.connectOpts = connectOpts;
  }
  async ping() {
    return await oneChatFromSocketClient<Command2Daemon>({action: 'ping'}, this.connectOpts);
  }
  async info(id: string) {
    return await oneChatFromSocketClient<CommandCommon>({action: 'info', data: id}, this.connectOpts);
  }
  async start(data?: Command2Process['data']) {
    return await oneChatFromSocketClient<Command2Process>({action: 'start', data}, this.connectOpts);
  }
  async stop(id: string) {
    return await oneChatFromSocketClient<CommandCommon>({action: 'stop', data: id}, this.connectOpts);
  }
  async restart(data?: Command2Process['data']) {
    return await oneChatFromSocketClient<Command2Process>({action: 'restart', data}, this.connectOpts);
  }
  async log(data?: string | LogQuery) {
    return await oneChatFromSocketClient<CommandLog>({action: 'log', data}, this.connectOpts);
  }
}
