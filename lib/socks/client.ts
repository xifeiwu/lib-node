import {globalClientState, getSocket, pushState} from './service';
import {SocksInfoOnClient} from './service/types';
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
  v5: infoNegotiationV5,
  vc1: infoNegotiationVc1,
};
/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer<Version extends SocksVersion>(config: SocksClientConfig<Version>) {
  const {socksVersion, targetSocksServer, ...negotiationInfo} = config;
  const clientInfo: SocksInfoOnClient<Version> = {
    socksVersion,
    stateTracer: [],
  };
  const {stateTracer} = clientInfo;
  try {
    pushState(globalClientState.startNegotiation, stateTracer);
    let socket = await getSocket(targetSocksServer);
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
    pushState(globalClientState.finishNegotiation, stateTracer);
    return clientInfo;
  } catch (err) {
    pushState(`${globalClientState.catchError}: ${err.message}`, stateTracer);
    // status.error = err;
    throw err;
  }
}
