import {globalClientState, getSocket} from './service';
import {getSocketInfo} from './service/external';
import {SocksClientInfo} from './service/types';
import {SocksClientConfig, SocksClientExchangeInfoConfigV6, SocksVersion} from './service/types/cross';
import {exchangeInfo as exchangeInfoV5} from './v5/client';
import {exchangeInfo as exchangeInfoV6} from './v6/client';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer<Version extends SocksVersion>(config: SocksClientConfig<Version>) {
  const {targetSocksServer, socksVersion, ...rest4Exchange} = config;
  const clientInfo: SocksClientInfo = {
    socketInfo: {},
    stateTracer: [],
  };
  // const stateTracer: SocksClientInfo['stateTracer'] = [];
  const {stateTracer} = clientInfo;
  try {
    stateTracer.push(globalClientState.startNegotiation);
    let socket = await getSocket(targetSocksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    clientInfo.socket = socket;
    clientInfo.socketInfo = getSocketInfo(socket);

    let infoFromNegotiation = {};
    if (socksVersion === 'v5') {
      infoFromNegotiation = await exchangeInfoV5(socket, {...rest4Exchange}, clientInfo);
    } else if (socksVersion === 'v6') {
      infoFromNegotiation = await exchangeInfoV6(
        socket,
        {...rest4Exchange} as unknown as SocksClientExchangeInfoConfigV6,
        clientInfo
      );
    }
    for (const [key, value] of Object.entries(infoFromNegotiation)) {
      clientInfo[key] = value;
    }
    socket.resume();
    stateTracer.push(globalClientState.finishNegotiation);
  } catch (err) {
    stateTracer.push(`${globalClientState.catchError}: ${err.message}`);
    // status.error = err;
    throw err;
  } finally {
    clientInfo.stateTracer = stateTracer;
  }
  return clientInfo;
}
