import {formatDate, isNumber} from '../../external';
import {ProxyStatus} from './types';
import {ColorStyle, logColorful} from './external';

const MAX_RROXY_STATUS_LENGTH = 100;

export function getPreRequestCb(config: {
  statusList: ProxyStatus[];
  maxSize?: number;
  maxAge?: number;
  logTheme?: ColorStyle;
}) {
  const {statusList, maxSize = MAX_RROXY_STATUS_LENGTH, maxAge, logTheme} = config;
  return (proxyStatus: ProxyStatus, proxyInfo) => {
    const {href: targetHref} = proxyInfo;
    const {ts, requestInfo: reqInfo} = proxyStatus;
    const dt = formatDate(ts, 'MM-ddThh:mm:ss.SSS');
    let id = dt;
    let cnt = 0;
    while (statusList.some(it => it.id === id) && cnt < maxSize) {
      id = `${dt}-${cnt}`;
      cnt++;
    }
    proxyStatus.id = id;
    const {
      origin: {method, url},
      proxy,
    } = reqInfo;
    logColorful(logTheme ?? {color: 'yellow'}, `[${id}]: ${method.toUpperCase()} ${url} -> ${targetHref}`);
    if (isNumber(maxAge) && maxAge > 0) {
      const now = Date.now();
      for (let i = statusList.length; i >= 0; i--) {
        if (now - statusList[i].ts > maxAge) {
          statusList.splice(i, 1);
        }
      }
    }
    if (statusList.length > maxSize) {
      statusList.pop();
    }
    statusList.unshift(proxyStatus);
    return proxyStatus;
  };
}

export function makeSureSerializable(proxyStatusList: ProxyStatus[]) {
  return proxyStatusList.map(proxyStatus => {
    const {id, requestInfo, ...restProxyStatus} = proxyStatus;
    if (!requestInfo) {
      return proxyStatus;
    }
    const {origin, proxy} = requestInfo;
    if (!proxy) {
      return proxyStatus;
    }
    const {agent, ...restProxy} = proxy;
    if (!agent) {
      return proxyStatus;
    }
    return {
      id,
      requestInfo: {
        origin,
        proxy: restProxy,
      },
      ...restProxyStatus,
    };
  });
}
