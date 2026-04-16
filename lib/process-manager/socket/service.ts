import fs from 'fs';
import path from 'path';
import {Socket} from 'net';
import {getFileList, startSocketClient, DAEMON_SOCKET_DIR, SOCKET_FILE_SUFFIX} from '../service/external';

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
