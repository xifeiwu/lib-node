import {DaemonConfig} from '../types';
import {waitIpcMessageOnce, outOnAllChannels} from '../external';
import {CpDaemon, getErrorResponse} from '../daemon';

async function start() {
  try {
    const ipcMessage: DaemonConfig = await waitIpcMessageOnce<DaemonConfig>();
    const cpDaemon = new CpDaemon();
    const response = await cpDaemon.startAsCp(ipcMessage);
    outOnAllChannels(response);
  } catch (err) {
    outOnAllChannels(getErrorResponse(err));
  }
}
start();
