import dns from 'dns';
import {EHandleClientRequestState, SocksClientStatus, SocksProxyConfig, ClientRequestInfo, AllSocksProxyConfig} from './types';
import {ERRORS, createError, getAddressType, getMatchedProxyConfig} from './utils';
import {connectToSocksServer} from '../client';
import {deepClone, isString} from './external';
import {Socket, isIP} from 'net';

const state = {
  matchProxyConfig: 'target server match proxy config',
  proxyToSocksServerSuccess: 'proxy to socks server success',
};
export async function proxySocksRequest(
  targetServiceInfo: ClientRequestInfo,
  proxyConfigList?: Array<AllSocksProxyConfig>
) {
  const stateTracer: SocksClientStatus['stateTracer'] = [];
  if (!Array.isArray(proxyConfigList) || proxyConfigList.length === 0) {
    return null;
  }
  const proxyConfig = (proxyConfigList ?? []).find(getMatchedProxyConfig.bind(null, targetServiceInfo));
  if (!proxyConfig) {
    return null;
  }
  stateTracer.push(state.matchProxyConfig);
  stateTracer.push({key: 'targetSocksServer', value: proxyConfig.targetSocksServer});
  try {
    const {socksVersion, ...restProps} = proxyConfig;
    const proxyClientInfo = await connectToSocksServer({socksVersion, ...restProps, clientRequestInfo: targetServiceInfo});
    stateTracer.push(state.proxyToSocksServerSuccess);
    return {stateTracer, proxyClientInfo};
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}

export async function handleConnection(clientRequestInfo: ClientRequestInfo) {
  const respondClientRequest = deepClone<ClientRequestInfo>(clientRequestInfo);
  const isDomain = isIP(clientRequestInfo.address) === 0;
  let state: 'dns' | 'connection' = 'dns';
  let socket: Socket;
  let connectState = EHandleClientRequestState.succeeded;
  try {
    if (isDomain) {
      const ip = await new Promise<string>((resolve, reject) => {
        dns.lookup(clientRequestInfo.address, function (err, ip) {
          if (err) {
            reject(err);
          } else {
            resolve(ip);
          }
        });
      });
      respondClientRequest.address = ip;
      respondClientRequest.addressType = getAddressType(ip);
    }
    state = 'connection';
    socket = await new Promise((res, rej) => {
      const socket = new Socket();
      socket.once('connect', () => {
        res(socket);
      });
      socket.once('error', err => {
        rej(EHandleClientRequestState.general_SOCKS_server_failure);
      });
      socket.once('timeout', err => {
        rej(EHandleClientRequestState.TTL_expired);
      });
      socket.connect({
        host: respondClientRequest.address,
        port: respondClientRequest.port,
      });
    });
  } catch (err) {
    const blockByDns = state === 'dns';
    connectState = blockByDns
      ? EHandleClientRequestState.Host_unreachable
      : isString(err)
      ? err
      : EHandleClientRequestState.Connection_refused;
  }
  return {
    socket,
    connectState,
    respondClientRequest,
  };
}
