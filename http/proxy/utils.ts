import {formatDate, isNumber} from '../../external';
import {LogColors, logWithColor} from '../../log';
import {ProxyStatus} from './types';

const MAX_RROXY_STATUS_LENGTH = 100;

export function getPreRequestCb(config: {
  statusList: ProxyStatus[];
  maxSize?: number;
  maxAge?: number;
  color?: LogColors;
}) {
  const {statusList, maxSize = MAX_RROXY_STATUS_LENGTH, maxAge, color} = config;
  return (proxyStatus: ProxyStatus) => {
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
      proxy: {href},
    } = reqInfo;
    logWithColor(color ?? 'yellow', `[${id}]: ${method.toUpperCase()} ${url} -> ${href}`);
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
    const {
      requestOptions: {agent, ...restRequestOptions},
      ...restProxy
    } = proxy;
    if (!agent) {
      return proxyStatus;
    }
    return {
      id,
      requestInfo: {
        origin,
        proxy: {
          ...restProxy,
          requestOptions: restRequestOptions,
        },
      },
      ...restProxyStatus,
    };
  });
}
