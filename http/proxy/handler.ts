import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {getRequestHeaderInfo, getResponseHeaderInfo} from '../common';
import {
  concatPath,
  deepClone,
  deepMerge,
} from '../../external';
import {AllRequestInfo, HttpProxyConfig, ProxyStatus} from './types';
import {getDataByTransform} from '../../stream';
import {toBuffer} from '../../transform';

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
/**
 * Proxy thre request.
 */
export async function proxyRequest(req: IncomingMessage, res: ServerResponse, config: HttpProxyConfig) {
  const proxyStatus: ProxyStatus = {ts: Date.now()};
  const {handleProxyReqInfo, handleRes2ProxyInfo, preRequestCb} = config;
  let reqInfo = getRequestInfo(req, config);
  proxyStatus.request = reqInfo;
  if (handleProxyReqInfo) {
    const tmp = await handleProxyReqInfo(reqInfo.proxy);
    if (tmp) {
      reqInfo.proxy = tmp;
    }
  }
  const {href, protocol, requestOptions: proxyRequestOptions} = reqInfo.proxy;
  preRequestCb && preRequestCb(proxyStatus);
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
