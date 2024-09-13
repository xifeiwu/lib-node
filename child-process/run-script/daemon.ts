import fs from 'fs';
import net from 'net';
import path from 'path';
import {InfoToCp} from '../../types';
import {out} from './service';
import {DaemonConfig} from './types';
import {fromBuffer, makeSureDirExistForFile, toBuffer, waitParentMessageFromIPC} from '../../index';
import {socketDir} from '../service';

export async function start() {
  const ipcMessage: InfoToCp<DaemonConfig> = await waitParentMessageFromIPC<DaemonConfig>();
  const {config = {}} = ipcMessage;
  let socketPath = config.socketPath;
  const pid = process.pid;
  if (!fs.existsSync(socketPath)) {
    socketPath = path.join(socketDir, pid + '.socket');
    makeSureDirExistForFile(socketPath);
  }
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

start();
