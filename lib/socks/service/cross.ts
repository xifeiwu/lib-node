import dns from 'dns';
import {SocksClientInfo, ProxyConfig} from './types';
import {ERRORS, createError, getAddressType, getMatchedProxyConfig, toRequestTargetV5} from './utils';
import {connectToSocksServer} from '../client';
import {deepClone, isString} from './external';
import {Socket, isIP} from 'net';
import {EAddressType, EHandleRequestTargetState, RequestTargetV5, RequestTargetV5Response} from './types/v5';

const state = {
  matchProxyConfig: 'target server match proxy config',
  proxyToSocksServerSuccess: 'proxy to socks server success',
};
export async function proxySocksRequest(
  requestTarget: RequestTargetV5,
  proxyConfigList?: Array<ProxyConfig>,
  stateTracer?: string[]
) {
  // const stateTracer: SocksClientInfo['stateTracer'] = [];
  if (!Array.isArray(proxyConfigList) || proxyConfigList.length === 0) {
    return null;
  }
  const proxyConfig = (proxyConfigList ?? []).find(getMatchedProxyConfig.bind(null, requestTarget));
  if (!proxyConfig) {
    return null;
  }
  stateTracer.push(state.matchProxyConfig);
  stateTracer.push({key: 'targetSocksServer', value: proxyConfig.targetSocksServer});
  try {
    const {socksVersion, ...restProps} = proxyConfig;
    const proxyClientInfo = await connectToSocksServer({
      socksVersion,
      requestTarget,
      ...restProps,
    });
    stateTracer.push(state.proxyToSocksServerSuccess);
    return {stateTracer, proxyClientInfo};
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}

export async function handleConnection(origin: RequestTargetV5): Promise<{
  socket: Socket;
  requestTargetResponse: RequestTargetV5Response;
}> {
  let {address, port} = toRequestTargetV5(origin);
  let addressType: EAddressType = getAddressType(address);
  const isDomain = isIP(address) === 0;
  let state: 'dns' | 'connection' = 'dns';
  let socket: Socket;
  let reply: EHandleRequestTargetState = EHandleRequestTargetState.succeeded;
  try {
    if (isDomain) {
      const ip = await new Promise<string>((resolve, reject) => {
        dns.lookup(address, function (err, ip) {
          if (err) {
            reject(err);
          } else {
            resolve(ip);
          }
        });
      });
      address = ip;
      addressType = getAddressType(ip);
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
        host: address,
        port: port,
      });
    });
  } catch (err) {
    const blockByDns = state === 'dns';
    reply = blockByDns
      ? EHandleRequestTargetState.Host_unreachable
      : isString(err)
      ? EHandleRequestTargetState.general_SOCKS_server_failure
      : EHandleRequestTargetState.Connection_refused;
  }
  return {
    socket,
    requestTargetResponse: {
      reply,
      address,
      port,
      addressType,
    },
  };
}
