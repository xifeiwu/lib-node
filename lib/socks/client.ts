import {globalClientState, getSocket} from './service';
import {getSocketInfo} from './service/external';
import {SocksClientStatus} from './service/types';
import {
  InfoNegotiationFunc,
  SocksClientConfig,
  SocksClientNegotiationInfoV6,
  SocksVersion,
} from './service/types/cross';
import {infoNegotiation as infoNegotiationV5} from './v5/client';
import {infoNegotiation as infoNegotiationV6} from './vc1/client';

const infoNegotiation: {
  [version in SocksVersion]: InfoNegotiationFunc<SocksVersion>;
} = {
  v5: infoNegotiationV5,
  v6: infoNegotiationV6,
};
/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer<Version extends SocksVersion>(config: SocksClientConfig<Version>) {
  const {socksVersion, targetSocksServer, ...rest4Exchange} = config;
  const clientInfo: SocksClientStatus = {
    socketInfo: {},
    stateTracer: [],
  };
  const {stateTracer} = clientInfo;
  try {
    stateTracer.push(globalClientState.startNegotiation);
    let socket = await getSocket(targetSocksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    clientInfo.socket = socket;
    clientInfo.socketInfo = getSocketInfo(socket);
    const infoFromNegotiation = await infoNegotiation[socksVersion](socket, rest4Exchange, clientInfo);
    for (const [key, value] of Object.entries(infoFromNegotiation)) {
      clientInfo[key] = value;
    }
    socket.resume();
    stateTracer.push(globalClientState.finishNegotiation);
  } catch (err) {
    stateTracer.push(`${globalClientState.catchError}: ${err.message}`);
    // status.error = err;
    throw err;
  }
  return clientInfo;
}
