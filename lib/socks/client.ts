import {CLIENT_STATE, getSocketToSocksServer, pushState} from './service';
import {SocksClientInfo} from './service/types';
import {
  NegotiationResult,
  NegotiationWithServer,
  SocksClientConfig,
  SocksVersion,
} from './service/types/client';
import {negotiation as infoNegotiationV5} from './v5/client';
import {negotiation as infoNegotiationVc1} from './vc1/client';

const infoNegotiation: {
  [version in SocksVersion]: NegotiationWithServer<SocksVersion>;
} = {
  5: infoNegotiationV5,
  1: infoNegotiationVc1,
};
/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer<Version extends SocksVersion>(config: SocksClientConfig<Version>) {
  const {socksVersion, socksServer, ...negotiationInfo} = config;
  const clientInfo: SocksClientInfo<Version> = {
    socksVersion,
    stateTracer: [],
  };
  const {stateTracer} = clientInfo;
  try {
    pushState(CLIENT_STATE.startConnectToSocksServer, stateTracer);
    let socket = await getSocketToSocksServer(socksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    clientInfo.socket = socket;
    const negotiationResult = (await infoNegotiation[socksVersion](
      socket,
      negotiationInfo,
      clientInfo.stateTracer
    )) as NegotiationResult[Version];
    clientInfo.negotiationResult = negotiationResult;
    socket.resume();
    pushState(CLIENT_STATE.finishNegotiation, stateTracer);
  } catch (err) {
    // pushState(`${globalClientState.catchError}: ${err.message}`, stateTracer);
    // status.error = err;
    // throw err;
    clientInfo.error = err;
  }
  return clientInfo;
}
