import dns from 'dns';
import {ETargetServiceConnectState, SocksClientInfo, SocksProxyConfig, TargetServiceInfo} from './types';
import {ERRORS, createError, getAddressType, getMatchedProxyConfig} from './utils';
import {connectToSocksServer} from '../client';
import {deepClone, isString} from './external';
import {Socket, isIP} from 'net';

const state = {
  matchProxyConfig: 'target server match proxy config',
  proxyToSocksServerSuccess: 'proxy to socks server success',
};
export async function proxySocksRequest(
  targetServiceInfo: TargetServiceInfo,
  proxyConfigList?: SocksProxyConfig[]
) {
  const stateTracer: SocksClientInfo['stateTracer'] = [];
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
    const proxyClientInfo = await connectToSocksServer({socksVersion, ...restProps, targetServiceInfo});
    stateTracer.push(state.proxyToSocksServerSuccess);
    return {stateTracer, proxyClientInfo};
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}

export async function handleConnection(clientRequest: TargetServiceInfo) {
  const repliedServiceInfo = deepClone<TargetServiceInfo>(clientRequest);
  const isDomain = isIP(clientRequest.address) === 0;
  let state: 'dns' | 'connection' = 'dns';
  let socket: Socket;
  let connectState = ETargetServiceConnectState.succeeded;
  try {
    if (isDomain) {
      const ip = await new Promise<string>((resolve, reject) => {
        dns.lookup(clientRequest.address, function (err, ip) {
          if (err) {
            reject(err);
          } else {
            resolve(ip);
          }
        });
      });
      repliedServiceInfo.address = ip;
      repliedServiceInfo.addressType = getAddressType(ip);
    }
    state = 'connection';
    socket = await new Promise((res, rej) => {
      const socket = new Socket();
      socket.once('connect', () => {
        res(socket);
      });
      socket.once('error', err => {
        rej(ETargetServiceConnectState.general_SOCKS_server_failure);
      });
      socket.once('timeout', err => {
        rej(ETargetServiceConnectState.TTL_expired);
      });
      socket.connect({
        host: repliedServiceInfo.address,
        port: repliedServiceInfo.port,
      });
    });
  } catch (err) {
    const blockByDns = state === 'dns';
    connectState = blockByDns
      ? ETargetServiceConnectState.Host_unreachable
      : isString(err)
      ? err
      : ETargetServiceConnectState.Connection_refused;
  }
  return {
    socket,
    connectState,
    repliedServiceInfo,
  };
}
