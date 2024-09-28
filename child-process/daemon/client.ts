import fs from 'fs';
import path from 'path';
import {
  getFileList,
  startSocketClient,
  fromBuffer,
  toBuffer,
  getSocketInfo,
  oneChatFromSocketClient,
} from '../../index';
import {NetConnectOpts, Socket} from 'net';
import {CP, Daemon, InfoToCp} from '../../types';
import {isString} from 'markdown-it/lib/common/utils';
import {DAEMON_SOCKET_DIR, SOCKET_FILE_SUFFIX} from '../../constants';

interface CheckSocketActivityConfig {
  closeActive?: boolean;
  closeInActive?: boolean;
}
export async function checkDaemonSocketActivity(
  socketPath: string,
  config?: CheckSocketActivityConfig
): Promise<boolean | null> {
  const {closeInActive = true, closeActive = false} = config ?? {};
  if (!fs.existsSync(socketPath)) {
    return null;
  }
  let client: Socket;
  try {
    client = await startSocketClient(socketPath);
    return true;
  } catch (err) {
    closeInActive && fs.unlinkSync(socketPath);
    return false;
  } finally {
    client && client.destroy();
  }
}

export async function checkDaemonSocketActivityByDir(dirname?: string, config?: CheckSocketActivityConfig) {
  dirname = dirname ?? DAEMON_SOCKET_DIR;
  const {closeInActive = true, closeActive = false} = config ?? {};
  if (!fs.existsSync(dirname)) {
    throw new Error(`dir ${dirname} not exist`);
  }
  const socketFullPathList = getFileList(dirname, {
    fileFilter({basename}) {
      return basename.endsWith(SOCKET_FILE_SUFFIX);
    },
  }).map(relativePath => path.join(dirname, relativePath));
  const active: string[] = [];
  const deactive: string[] = [];
  for (const socketPath of socketFullPathList) {
    const result = await checkDaemonSocketActivity(socketPath, config);
    if (result) {
      active.push(socketPath);
    } else {
      deactive.push(socketPath);
    }
  }
  return {active, deactive};
}

export class SocketClient {
  connectOpts: NetConnectOpts;
  constructor(connectOpts: NetConnectOpts) {
    this.connectOpts = connectOpts;
  }
  async ping() {
    return await oneChatFromSocketClient<Daemon.Command2Daemon>({action: 'ping'}, this.connectOpts);
  }
  async info(id: string) {
    return await oneChatFromSocketClient<Daemon.CommandCommon>({action: 'info', data: id}, this.connectOpts);
  }
  async start(data?: Daemon.Command2Process['data']) {
    return await oneChatFromSocketClient<Daemon.Command2Process>({action: 'start', data}, this.connectOpts);
  }
  async stop(id: string) {
    return await oneChatFromSocketClient<Daemon.CommandCommon>({action: 'stop', data: id}, this.connectOpts);
  }
  async restart(data?: Daemon.Command2Process['data']) {
    return await oneChatFromSocketClient<Daemon.Command2Process>({action: 'restart', data}, this.connectOpts);
  }
}
