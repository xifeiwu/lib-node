import {SocketConfig} from '../../types';
import {waitIpcMessageOnce, outOnAllChannels} from '../../external';
import {DaemonSocketServer} from '../server';
import {getErrorResponse} from '../../service';

async function start() {
  try {
    const ipcMessage = await waitIpcMessageOnce<SocketConfig>();
    const socketServer = new DaemonSocketServer();
    const response = await socketServer.startAsCp(ipcMessage);
    outOnAllChannels(response);
  } catch (err) {
    outOnAllChannels(getErrorResponse(err));
  }
}

start();
