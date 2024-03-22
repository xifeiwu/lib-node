import {HttpServerConfig, startHttpServer} from '../server';
import {formatDate, toUrlInstance, isNumber} from '../../external';
import {HttpProxyConfig, ProxyStatus} from './types';
import {getRequestHeaderInfo} from '../common';
import {toBuffer} from '../../transform';
import {proxyRequest} from './handler';
import {LogColors, logWithColor} from '../../log';

export function getPreRequestCb(config: {
  statusList: ProxyStatus[];
  maxSize: number;
  maxAge?: number;
  color?: LogColors;
}) {
  const {statusList, maxSize, maxAge, color} = config;
  return (proxyStatus: ProxyStatus) => {
    const {ts, request: reqInfo} = proxyStatus;
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

export const PATHNAME_PROXY_STATUS = '/api/proxy-status';
export async function startProxyServer(proxyConfig: HttpProxyConfig, httpServerConfig?: HttpServerConfig) {
  const MAX_RROXY_STATUS_LENGTH = 100;
  const proxyStatusList: ProxyStatus[] = [];
  const {origin, host, port, server} = await startHttpServer(
    {
      request: (req, res) => {
        const {url} = getRequestHeaderInfo(req);
        const {pathname, searchParams} = toUrlInstance(url);

        if (pathname === PATHNAME_PROXY_STATUS) {
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          let resData: any = proxyStatusList;
          if (searchParams.has('id')) {
            resData = proxyStatusList.find(it => it.id === searchParams.get('id'));
          }
          res.end(toBuffer(JSON.stringify(resData)));
          return;
        } else {
          proxyRequest(req, res, {
            ...proxyConfig,
            preRequestCb: getPreRequestCb({
              statusList: proxyStatusList,
              maxSize: MAX_RROXY_STATUS_LENGTH,
            }),
          });
        }
      },
    },
    httpServerConfig
  );
  return {origin, host, port, server};
}
