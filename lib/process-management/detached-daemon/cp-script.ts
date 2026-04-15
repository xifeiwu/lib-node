import {DaemonConfig} from '../types';
import {waitIpcMessageOnce, outOnAllChannels} from '../external';
import {DaemonSocketServer} from '../daemon/socket-server';
import {getErrorResponse} from '../service';

async function start() {
  try {
    const ipcMessage: DaemonConfig = await waitIpcMessageOnce<DaemonConfig>();
    const cpDaemon = new DaemonSocketServer();
    const response = await cpDaemon.startAsCp(ipcMessage);
    outOnAllChannels(response);
  } catch (err) {
    outOnAllChannels(getErrorResponse(err));
  }
}

start();
