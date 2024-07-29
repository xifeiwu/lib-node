import {getSocket} from './service';
import {SocksClientStatus} from './service/types';
import {SocketClientConfig, SocksVersion} from './service/types/cross';
import {socketCommunication as socketCommV5} from './v5/client';
import {clientState} from './v5/service';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer<Version extends SocksVersion>(
  config: SocketClientConfig<Version>
) {
  const {socksVersion, targetSocksServer, ...restConfig4Comm} = config;
  const status: SocksClientStatus = {};
  const stateTracer: string[] = [];
  try {
    stateTracer.push('start connect to socks server');
    let socket = await getSocket(targetSocksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    status.socket = socket;
    const info = await socketCommV5(socket, {...restConfig4Comm, stateTracer});
    for (const [key, value] of Object.entries(info)) {
      status[key] = value;
    }
    socket.resume();
    stateTracer.push(clientState.finishedProcess);
  } catch (err) {
    stateTracer.push(`${clientState.logicError}: ${err.message}`);
    // status.error = err;
    throw err;
  } finally {
    status.stateTracer = stateTracer;
  }
  return status;
}
