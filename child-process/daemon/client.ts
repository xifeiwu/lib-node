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
    let client: Socket;
    try {
      client = await startSocketClient(socketPath);
      active.push(socketPath);
    } catch (err) {
      closeInActive && fs.unlinkSync(socketPath);
      deactive.push(socketPath);
    } finally {
      client && client.end();
    }
  }
  return {active, deactive};
}
