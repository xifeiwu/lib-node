import {clientState, getSocket} from './service';
import {getSocketInfo} from './service/external';
import {SocksClientInfo} from './service/types';
import {SocketClientConfig, SocksVersion} from './service/types/cross';
import {exchangeInfo as exchangeInfoV5} from './v5/client';

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
  const {socksVersion, targetSocksServer, ...rest4Exchange} = config;
  const status: SocksClientInfo = {
    socketInfo: {},
  };
  const stateTracer: SocksClientInfo['stateTracer'] = [];
  try {
    stateTracer.push(clientState.startNegotiation);
    let socket = await getSocket(targetSocksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    status.socket = socket;
    status.socketInfo = getSocketInfo(socket);
    const {...restProps} = await exchangeInfoV5(socket, rest4Exchange, stateTracer);
    // stateTracer.push(...tracer);
    for (const [key, value] of Object.entries(restProps)) {
      status[key] = value;
    }
    socket.resume();
    stateTracer.push(clientState.finishNegotiation);
  } catch (err) {
    stateTracer.push(`${clientState.catchError}: ${err.message}`);
    // status.error = err;
    throw err;
  } finally {
    status.stateTracer = stateTracer;
  }
  return status;
}
