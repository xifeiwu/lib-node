import dns from 'dns';
import {EHandleRequestTargetState, SocksClientStatus, SocksProxyConfig, RequestTargetV5, AllSocksProxyConfig} from './types';
import {ERRORS, createError, getAddressType, getMatchedProxyConfig} from './utils';
import {connectToSocksServer} from '../client';
import {deepClone, isString} from './external';
import {Socket, isIP} from 'net';

const state = {
  matchProxyConfig: 'target server match proxy config',
  proxyToSocksServerSuccess: 'proxy to socks server success',
};
export async function proxySocksRequest(
  targetServiceInfo: RequestTargetV5,
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
    const proxyClientInfo = await connectToSocksServer({socksVersion, ...restProps, requestTarget: targetServiceInfo});
    stateTracer.push(state.proxyToSocksServerSuccess);
    return {stateTracer, proxyClientInfo};
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}

export async function handleConnection(origin: RequestTargetV5) {
  const requestTarget = deepClone<RequestTargetV5>(origin);
  const isDomain = isIP(requestTarget.address) === 0;
  let state: 'dns' | 'connection' = 'dns';
  let socket: Socket;
  let connectState: String | string | number = EHandleRequestTargetState.succeeded;
  try {
    if (isDomain) {
      const ip = await new Promise<string>((resolve, reject) => {
        dns.lookup(requestTarget.address, function (err, ip) {
          if (err) {
            reject(err);
          } else {
            resolve(ip);
          }
        });
      });
      requestTarget.address = ip;
      requestTarget.addressType = getAddressType(ip);
    }
    state = 'connection';
    socket = await new Promise((res, rej) => {
      const socket = new Socket();
      socket.once('connect', () => {
        res(socket);
      });
      socket.once('error', err => {
        rej(EHandleRequestTargetState.general_SOCKS_server_failure);
      });
      socket.once('timeout', err => {
        rej(EHandleRequestTargetState.TTL_expired);
      });
      socket.connect({
        host: requestTarget.address,
        port: requestTarget.port,
      });
    });
  } catch (err) {
    const blockByDns = state === 'dns';
    connectState = blockByDns
      ? EHandleRequestTargetState.Host_unreachable
      : isString(err)
      ? err
      : EHandleRequestTargetState.Connection_refused;
  }
  return {
    socket,
    connectState,
    requestTarget,
  };
}
