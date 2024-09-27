import fs from 'fs';
import path from 'path';
import {getFileList, startSocketClient, fromBuffer, toBuffer, getSocketInfo} from '../../../index';
import {NetConnectOpts, Socket} from 'net';
import {CP, Daemon, InfoToCp} from '../../../types';
import {isString} from 'markdown-it/lib/common/utils';
import {DAEMON_SOCKET_DIR, SOCKET_FILE_SUFFIX} from '../../../constants';

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

export async function chatWithDaemon(
  info: Daemon.Command,
  connectOpts: NetConnectOpts | string,
  config?: CheckSocketActivityConfig
) {
  let client: Socket;
  try {
    client = await startSocketClient(connectOpts as NetConnectOpts);
  } catch (err) {
    if (isString(connectOpts)) {
      /** Remove useless socket path */
      fs.unlinkSync(connectOpts);
    }
  }
  client.write(toBuffer(info));
  const response = await new Promise<CP.DaemonInfo>((res, rej) => {
    client.once('data', chunk => {
      res(fromBuffer(chunk, 'json') as CP.DaemonInfo);
    });
  });
  client.destroy();
  return response;
}

export async function ping(socketPath: string, config?: CheckSocketActivityConfig) {
  return await chatWithDaemon({action: 'ping'}, socketPath, config);
}
export async function info(socketPath: string, config?: CheckSocketActivityConfig) {
  return await chatWithDaemon({action: 'info'}, socketPath, config);
}
export async function start(
  socketPath: string,
  infoToCp?: Daemon.CpConfig,
  config?: CheckSocketActivityConfig
) {
  return await chatWithDaemon({action: 'start', data: infoToCp}, socketPath, config);
}
export async function stop(socketPath: string, config?: CheckSocketActivityConfig) {
  return await chatWithDaemon({action: 'stop'}, socketPath, config);
}
export async function restart(
  socketPath: string,
  infoToCp?: Daemon.CpConfig,
  config?: CheckSocketActivityConfig
) {
  return await chatWithDaemon({action: 'restart', data: infoToCp}, socketPath, config);
}
