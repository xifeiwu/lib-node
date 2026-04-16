import {DaemonConfig} from '../types';
import {waitIpcMessageOnce, outOnAllChannels} from '../external';
import {DaemonSocketServer} from './server';
import {getErrorResponse} from '../service';

async function start() {
  try {
    const ipcMessage: DaemonConfig = await waitIpcMessageOnce<DaemonConfig>();
    const socketServer = new DaemonSocketServer();
    const response = await socketServer.startAsCp(ipcMessage);
    outOnAllChannels(response);
  } catch (err) {
    outOnAllChannels(getErrorResponse(err));
  }
}

start();
