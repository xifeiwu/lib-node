import fs from 'fs';
import path from 'path';
import {socketDir, socketFileSuffix} from './service';
import {getFileList, startSocketClient, fromBuffer, toBuffer} from '../../index';
import {Socket} from 'net';
import {CP} from '../../types';

export async function ping(
  socketPath: string,
  config?: {
    closeOnInActive?: boolean;
  }
) {
  const {closeOnInActive = true} = config ?? {};
  try {
    const action: CP.DaemonAction = {action: 'ping'};
    const client = await startSocketClient(socketPath);
    client.end(toBuffer(action));
    return await new Promise<CP.DaemonInfo>((res, rej) => {
      client.once('data', chunk => {
        res(fromBuffer(chunk, 'json') as CP.DaemonInfo);
      });
    });
  } catch (err) {
    if (closeOnInActive) {
      fs.unlinkSync(socketPath);
    }
  }
}


export async function checkDaemonSocket(
  socketPath: string,
  config?: {
    closeActive?: boolean;
    closeInActive?: boolean;
  }
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

export async function checkSocketActivity(
  dirname?: string,
  config?: {
    closeActive?: boolean;
    closeInActive?: boolean;
  }
) {
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
    const result = await checkDaemonSocket(socketPath, config);
    if (result) {
      active.push(socketPath);
    } else {
      deactive.push(socketPath);
    }
  }
  return {active, deactive};
}
