import fs from 'fs';
import path from 'path';
import {socketDir, socketFileSuffix} from './service';
import {getFileList, startSocketClient, fromBuffer, toBuffer} from '../../index';
import {Socket} from 'net';
import {CP, InfoToCp} from '../../types';

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
    client && client.end();
  }
}

export async function checkDaemonSocketActivityByDir(dirname?: string, config?: CheckSocketActivityConfig) {
  dirname = dirname ?? socketDir;
  const {closeInActive = true, closeActive = false} = config ?? {};
  if (!fs.existsSync(dirname)) {
    throw new Error(`dir ${dirname} not exist`);
  }
  const socketFullPathList = getFileList(dirname, {
    fileFilter({basename}) {
      return basename.endsWith(socketFileSuffix);
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
  info: CP.DaemonAction,
  socketPath: string,
  config?: CheckSocketActivityConfig
) {
  const isActive = await checkDaemonSocketActivity(socketPath, config);
  if (!isActive) {
    return null;
  }
  const client = await startSocketClient(socketPath);
  client.end(toBuffer(info));
  const response = await new Promise<CP.DaemonInfo>((res, rej) => {
    client.once('data', chunk => {
      res(fromBuffer(chunk, 'json') as CP.DaemonInfo);
    });
  });
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
  infoToCp: InfoToCp<CP.DaemonConfig>,
  config?: CheckSocketActivityConfig
) {
  return await chatWithDaemon({action: 'start', info: infoToCp}, socketPath, config);
}
export async function stop(socketPath: string, config?: CheckSocketActivityConfig) {
  return await chatWithDaemon({action: 'stop'}, socketPath, config);
}
export async function restart(
  socketPath: string,
  infoToCp?: InfoToCp<CP.DaemonConfig>,
  config?: CheckSocketActivityConfig
) {
  return await chatWithDaemon({action: 'restart', info: infoToCp}, socketPath, config);
}
