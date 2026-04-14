import {DaemonConfig} from '../../types';
import {waitIpcMessageOnce, outOnAllChannels} from '../../external';
import {Daemon} from '../../cp-cluster';
import {getErrorResponse} from '../../service';

async function start() {
  try {
    const ipcMessage: DaemonConfig = await waitIpcMessageOnce<DaemonConfig>();
    const cpDaemon = new Daemon();
    const response = await cpDaemon.startAsCp(ipcMessage);
    outOnAllChannels(response);
  } catch (err) {
    outOnAllChannels(getErrorResponse(err));
  }
}
start();
