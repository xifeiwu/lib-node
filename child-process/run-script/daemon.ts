import fs from 'fs';
import net from 'net';
import path from 'path';
import {InfoToCp} from '../../types';
import {out} from './service';
import {DaemonConfig} from './types';
import {
  fromBuffer,
  getFilePathInfo,
  isObject,
  makeSureDirExist,
  toBuffer,
  waitParentMessageFromIPC,
} from '../../index';
import {socketDir} from '../daemon/service';
import {isString} from 'markdown-it/lib/common/utils';

function checkPermissionBeforeCreateDir(dirname: string) {
  if (dirname.startsWith(process.env.HOME)) {
    makeSureDirExist(dirname);
  } else {
    throw new Error(`Don't have permission to create dir: ${dirname}`);
  }
}
export async function start(args: any[]) {
  args = args.slice(2);
  const ipcMessage: InfoToCp<DaemonConfig> = await waitParentMessageFromIPC<DaemonConfig>();
  const {config = {}} = ipcMessage;
  const pid = process.pid;
  let socketPath = config.socketPath;
  /** use argument if ipcMessage is not passed */
  if (socketPath === undefined && args.length > 0) {
    socketPath = args[0];
  }
  let dirname: string;
  let basename: string;
  if (isString(socketPath)) {
    const pathInfo = getFilePathInfo(socketPath);
    dirname = pathInfo.dirname;
    basename = pathInfo.basename;
  } else if (isObject(socketPath)) {
    dirname = socketPath.dirname;
    basename = socketPath.basename;
  } else {
    dirname = socketDir;
    basename = pid + '.socket';
  }
  socketPath = path.join(dirname, basename);
  if (fs.existsSync(socketPath)) {
    throw new Error(`socketPath already exist, can not reuse an exsiting file`);
  }
  checkPermissionBeforeCreateDir(dirname);
  const response = {socketPath, pid};
  const server = net.createServer();
  server.listen(socketPath);
  server.on('connection', socket => {
    socket.write(toBuffer(response));
    socket.on('data', chunk => {
      const data = fromBuffer(chunk, 'json') as {action: 'ping'};
      if (data.action === 'ping') {
        socket.write(toBuffer('pong'));
      }
    });
  });
  await new Promise<void>((res, rej) => {
    server.on('listening', () => {
      out(response);
      res();
    });
    server.on('error', err => rej(err));
  });
}

start(process.argv);
