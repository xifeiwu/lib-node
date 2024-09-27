import {Daemon, InfoToCp} from '../../types';
import {CpDaemon, getErrorResponse} from '../daemon/daemon';
import {waitParentMessageFromIPC} from '../spawn';
import {out} from './service';

async function start() {
  try {
    const ipcMessage: InfoToCp<Daemon.DaemonConfig> = await waitParentMessageFromIPC<Daemon.DaemonConfig>();
    const cpDaemon = new CpDaemon();
    const response = await cpDaemon.startAsCp(ipcMessage?.config);
    out(response);
  } catch (err) {
    out(getErrorResponse(err));
  }
}
start();
