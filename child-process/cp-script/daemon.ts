import {Daemon, InfoToCp} from '../../types';
import {CpDaemon, getErrorResponse} from '../daemon/daemon';
import {waitIpcMessageOnce} from '../service';
import {out} from './service/base';

async function start() {
  try {
    const ipcMessage: Daemon.DaemonConfig = await waitIpcMessageOnce<Daemon.DaemonConfig>();
    const cpDaemon = new CpDaemon();
    const response = await cpDaemon.startAsCp(ipcMessage);
    out(response);
  } catch (err) {
    out(getErrorResponse(err));
  }
}
start();
