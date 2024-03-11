import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {RequestInfo, getRequestHeaderInfo, getResponseHeaderInfo} from '../common';
import {HttpServerConfig, startHttpServer} from '../server';
import {
  cookieRewrite,
  concatPath,
  deepClone,
  deepMerge,
  formatDate,
  encodeQueryString,
  parseUrl,
} from '../../external';
import {HttpProxyConfig, ProxyRequestInfo, ProxyStatus} from './types';
import {getDataByTransform} from '../../stream';
import {toBuffer} from '../../transform';
import {logWithColor} from '../../log';

interface AllRequestInfo {
  origin: RequestInfo;
  proxy: ProxyRequestInfo;
}
/**
 * Get Request Info from origin request, and the Request Info used for proxy.
 * @param req
 * @param config
 * @returns
 */
function getRequestInfo(req: IncomingMessage, config: HttpProxyConfig): AllRequestInfo {
  const {targetHref, changeOrigin = true, proxyRequestOptions: defaultRequestOptions = {}} = config;
  const {protocol, origin, host, pathname} = new URL(targetHref);
  const {method, url, httpVersion, headers: originHeaders} = getRequestHeaderInfo(req);
  const proxyHeaders = deepClone(originHeaders);
  const href = origin + concatPath('/', pathname, url);
  if (proxyHeaders.host && changeOrigin) {
    proxyHeaders.host = host;
  }
  return {
    origin: {
      method,
      url,
      httpVersion,
      headers: originHeaders,
    },
    proxy: {
      href,
      protocol,
      requestOptions: deepMerge(
        {
          method,
          headers: proxyHeaders,
        },
        defaultRequestOptions
      ),
    },
  };
}

const MAX_RROXY_STATUS_LENGTH = 100;
const proxyStatusList: ProxyStatus[] = [];
/**
 * Create proxyStatus item, push to proxyStatusList, and return the item.
 */
function pushStatus() {
  const dt = formatDate(new Date(), 'MM-ddThh:mm:ss.SSS');
  let newId = dt;
  let cnt = 0;
  while (proxyStatusList.some(it => it.id === newId) && cnt < MAX_RROXY_STATUS_LENGTH) {
    newId = `${dt}-${cnt}`;
    cnt++;
  }
  const item: ProxyStatus = {id: newId};
  if (proxyStatusList.length > MAX_RROXY_STATUS_LENGTH) {
    proxyStatusList.pop();
  }
  proxyStatusList.unshift(item);
  return item;
}

function printLog(proxyStatus: ProxyStatus, reqInfo: AllRequestInfo, config: HttpProxyConfig) {
  const {isPrintLog = true, proxyServerInfo} = config;
  if (!isPrintLog) {
    return;
  }
  const {id} = proxyStatus;
  const {
    origin: {method, url},
    proxy: {href},
  } = reqInfo;
  logWithColor('yellow', `[${id}]: ${method.toUpperCase()} ${url} -> ${href}`);
  proxyServerInfo &&
    logWithColor(
      'black',
      `${proxyServerInfo.origin}${proxyServerInfo.url2ProxyStatus ?? ''}${encodeQueryString(
        {
          id: id,
        },
        false
      )}`
    );
}
/**
 * Proxy thre request.
 */
export async function proxyRequest(req: IncomingMessage, res: ServerResponse, config: HttpProxyConfig) {
  const proxyStatus = pushStatus();
  const {handleProxyReqInfo, handleRes2ProxyInfo} = config;
  let reqInfo = getRequestInfo(req, config);
  proxyStatus.request = reqInfo;
  if (handleProxyReqInfo) {
    const tmp = await handleProxyReqInfo(reqInfo.proxy);
    if (tmp) {
      reqInfo.proxy = tmp;
    }
  }
  const {href, protocol, requestOptions: proxyRequestOptions} = reqInfo.proxy;
  printLog(proxyStatus, reqInfo, config);
  const proxyReq = (protocol === 'https:' ? https : http).request(href, proxyRequestOptions);
  req
    .pipe(
      getDataByTransform(
        data => {
          proxyStatus.request.origin.data = data;
        },
        {
          targetType: 'json',
        }
      )
    )
    .pipe(proxyReq);

  try {
    const res2Proxy = await new Promise<http.IncomingMessage>((res, rej) => {
      proxyReq.on('error', err => {
        rej(err);
      });
      proxyReq.on('response', res2Proxy => res(res2Proxy));
    });
    const res2ProxyInfo = getResponseHeaderInfo(res2Proxy);
    let res2OriginInfo = deepClone(res2ProxyInfo);
    /** Rewrite cookie info */
    for (let [key, value] of Object.entries(res2OriginInfo.headers)) {
      let newValue = value;
      // if (key.toLowerCase() === 'set-cookie') {
      //   newValue = cookieRewrite(value, 'domain', '0.0.0.0');
      // }
      res2OriginInfo.headers[key] = newValue;
    }
    if (handleRes2ProxyInfo) {
      const tmp = handleRes2ProxyInfo(res2OriginInfo);
      if (tmp) {
        res2OriginInfo = tmp;
      }
    }
    proxyStatus.response = {
      toProxy: res2ProxyInfo,
      toOrigin: res2OriginInfo,
    };
    const {httpVersion, statusCode, statusMessage, headers} = res2OriginInfo;
    res.statusCode = statusCode;
    res.statusMessage = statusMessage ?? '';
    for (const [key, value] of Object.entries(res2OriginInfo.headers)) {
      res.setHeader(key, value);
    }
    res2Proxy
      .pipe(
        getDataByTransform(
          data => {
            proxyStatus.response.toProxy.data = data;
          },
          {
            targetType: 'json',
          }
        )
      )
      .pipe(res);
  } catch (err) {
    res.statusCode = 500;
    res.statusMessage = 'proxy error';
    const {message, stack} = err as Error;
    const errorInfo = {message, stack};
    proxyStatus.err = errorInfo;
    res.end(toBuffer(errorInfo));
  }
}

export const URL_PROXY_STATUS = '/api/proxy-status';
export async function startProxyServer(proxyConfig: HttpProxyConfig, httpServerConfig?: HttpServerConfig) {
  const {origin, host, port, server} = await startHttpServer(
    {
      request: (req, res) => {
        const {url} = getRequestHeaderInfo(req);
        const {pathname, searchParams} = parseUrl(url);

        if (pathname === URL_PROXY_STATUS) {
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          let resData: any = proxyStatusList;
          if (searchParams.has('id')) {
            resData = proxyStatusList.find(it => it.id === searchParams.get('id'));
          }
          res.end(toBuffer(JSON.stringify(resData)));
          return;
        }
        proxyRequest(req, res, {
          ...proxyConfig,
          proxyServerInfo: {origin, url2ProxyStatus: URL_PROXY_STATUS},
        });
      },
    },
    httpServerConfig
  );
  return {origin, host, port, server};
}
