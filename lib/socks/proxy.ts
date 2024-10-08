import {Socket} from 'net';
import {ProxyConfig, SocksInfoOnClient} from './service/types';
import {
  ERRORS,
  connectFromLocal,
  createError,
  getMatchedProxyConfig,
  globalServerState,
  pushState,
  serializaleSocksClientInfo,
} from './service';
import {connectToSocksServer} from './client';
import {EHandleRequestTargetState, RequestTargetV5, RequestTargetV5Response} from './service/types/v5';
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
  pushState(globalServerState.matchProxyConfig, stateTracer);
  pushState({key: 'targetSocksServer', value: proxyConfig.socksServer}, stateTracer);
  try {
    const {socksVersion, ...restProps} = proxyConfig;
    const proxyClientInfo = await connectToSocksServer({
      socksVersion,
      requestTarget,
      ...restProps,
    });
    pushState({key: 'proxyClientInfo', value: serializaleSocksClientInfo(proxyClientInfo)}, stateTracer);
    pushState(globalServerState.proxyToSocksServerSuccess, stateTracer);
    return proxyClientInfo;
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}

export async function handleCommandConnect(
  requestTarget: RequestTargetV5,
  options: {proxyConfigList?: ProxyConfig[]; stateTracer: StateTracer}
): Promise<{
  socket: Socket;
  requestTargetResponse: RequestTargetV5Response;
  socksClientInfo?: SocksInfoOnClient;
}> {
  const {proxyConfigList, stateTracer} = options ?? {};
  const socksClientInfo = await tryProxyRequestTarget(requestTarget, proxyConfigList, stateTracer);
  // let socket2Server: Socket;
  // let requestTargetResponse: RequestTargetV5Response;
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
