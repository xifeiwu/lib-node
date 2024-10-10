import {Socket} from 'net';
import {ProxyConfig, SocksClientInfo} from './service/types';
import {
  ERRORS,
  SERVER_STATE,
  connectFromLocal,
  createError,
  getMatchedProxyConfig,
  pushState,
  serializableSocksClientInfo,
} from './service';
import {connectToSocksServer} from './client';
import {EHandleRequestTargetState, RequestTargetV5, RequestTargetResponseV5} from './service/types/v5';
import {StateTracer} from './service/types/base';

/**
 * If requestTarget match condition, send a new socks request to the target socks server
 * @param requestTarget
 * @param proxyConfigList
 * @param stateTracer
 * @returns
 */
export async function tryProxyRequestTarget(
  requestTarget: RequestTargetV5,
  proxyConfigList?: Array<ProxyConfig>,
  stateTracer?: StateTracer
) {
  // const stateTracer: SocksClientInfo['stateTracer'] = [];
  if (!Array.isArray(proxyConfigList) || proxyConfigList.length === 0) {
    return null;
  }
  const proxyConfig = (proxyConfigList ?? []).find(getMatchedProxyConfig.bind(null, requestTarget));
  if (!proxyConfig) {
    return null;
  }
  const {socksVersion, socksServer} = proxyConfig;
  pushState(
    SERVER_STATE.willProxyToRemoteSocksServer + JSON.stringify({socksVersion, socksServer}),
    stateTracer
  );
  try {
    const {socksVersion, ...restProps} = proxyConfig;
    const proxyClientInfo = await connectToSocksServer({
      socksVersion,
      requestTarget,
      ...restProps,
    });
    pushState(SERVER_STATE.proxyToRemoteSocksServerSuccess, stateTracer);
    return proxyClientInfo;
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}

/**
 * handle connect request from client side
 * @param requestTarget
 * @param options
 * @returns
 */
export async function handleConnectCommand(
  requestTarget: RequestTargetV5,
  options: {proxyConfigList?: ProxyConfig[]; stateTracer: StateTracer}
): Promise<{
  socket: Socket;
  requestTargetResponse: RequestTargetResponseV5;
  socksClientInfo?: SocksClientInfo;
}> {
  const {proxyConfigList, stateTracer} = options ?? {};
  const socksClientInfo = await tryProxyRequestTarget(requestTarget, proxyConfigList, stateTracer);
  if (socksClientInfo) {
    const {socket, negotiationResult} = socksClientInfo;
    return {
      socket,
      requestTargetResponse: {
        reply: EHandleRequestTargetState.succeeded,
        ...(negotiationResult?.requestTargetResponse ?? {address: '8.8.8.8', port: 88}),
      },
      socksClientInfo,
    };
  } else {
    return await connectFromLocal(requestTarget);
  }
}
