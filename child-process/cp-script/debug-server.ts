import {startHttpDebugServer} from '../../http';
import {logColorful} from '../../log';
import {HttpServerConfig} from '../../types';
import {waitIpcMessageOnce} from '../service';

async function start() {
  const supportIpc = Boolean(process.send);
  const config = await waitIpcMessageOnce<HttpServerConfig>({maxWaitInSec: 10});
  const serverInfo = await startHttpDebugServer(config, {logRequestHeaderInfo: 'black'});
  if (supportIpc) {
    process.send(serverInfo);
  }
  logColorful({color: 'yellow'}, {origin: serverInfo.origin});
}

start();
