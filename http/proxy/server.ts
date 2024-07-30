import {startHttpServer} from '../server';
import {HttpProxyConfig, ProxyStatus} from './types';
import {getRequestHeaderInfo} from '../common';
import {toBuffer} from '../../transform';
import {proxyRequest} from './handler';
import {toUrlInstance} from '../../external';
import {getPreRequestCb} from './utils';
import {HttpServerConfig} from '../../types';

export const PATHNAME_PROXY_STATUS = '/api/proxy-status';
export async function startProxyServer(proxyConfig: HttpProxyConfig, httpServerConfig?: HttpServerConfig) {
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
            preProxyReq: getPreRequestCb({
              statusList: proxyStatusList,
            }),
          });
        }
      },
    },
    httpServerConfig
  );
  return {origin, host, port, server};
}
