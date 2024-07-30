import {SocksClientInfo, SocksProxyConfig, TargetServiceInfo} from './types';
import {ERRORS, createError, getMatchedProxyConfig} from './utils';
import {connectToSocksServer} from '../client';

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
  stateTracer.push(proxyConfig.targetSocksServer);
  try {
    const {socksVersion, ...restProps} = proxyConfig;
    const proxyClientInfo = await connectToSocksServer({socksVersion, ...restProps, targetServiceInfo});
    stateTracer.push(state.proxyToSocksServerSuccess);
    return {stateTracer, proxyClientInfo};
  } catch (err) {
    throw createError(ERRORS.proxyError, err?.message);
  }
}
