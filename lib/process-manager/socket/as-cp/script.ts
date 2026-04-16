import {SocketConfig} from '../../types';
import {waitIpcMessageOnce, outOnAllChannels} from '../../external';
import {DaemonSocketServer} from '../server';
import {getErrorResponse} from '../../service';

async function start() {
  try {
    const ipcMessage = await waitIpcMessageOnce<SocketConfig>();
    const socketServer = new DaemonSocketServer(ipcMessage);
    const response = await socketServer.start();
    outOnAllChannels(response);
  } catch (err) {
    outOnAllChannels(getErrorResponse(err));
  }
}

start();
