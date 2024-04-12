import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {getRequestHeaderInfo, getResponseHeaderInfo} from '../common';
import {concatPath, deepClone, deepMerge} from '../../external';
import {AllRequestInfo, HttpProxyConfig, ProxyStatus} from './types';
import {toStream, getDataByTransform} from '../../stream';
import {toBuffer} from '../../transform';

/**
 * Get Request Info of both original request and that used for proxy request.
 * @param req
 * @param config
 * @returns
 */
function handleRequestInfo(req: IncomingMessage, config: HttpProxyConfig): AllRequestInfo {
  const {targetHref, changeOrigin, proxyRequestOptions: defaultRequestOptions = {}} = config;
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
 * Custmoiziable Request Proxy.
 * +--------+                                     +-------+                                     +--------+
 * |        |                                     |       |   handleProxyReqInfo,               |        |
 * |        | -----------originRequest----------> |       | -----------proxyRequest-----------> |        |
 * | Origin |                                     | Proxy |                                     | Target |
 * |        |   handleRes2OriginInfo,             |       |                                     |        |
 * |        | <--------response2Origin----------- |       | <---------response2Proxy----------- |        |
 * +--------+                                     +-------+                                     +--------+
 */
export async function proxyRequest(req: IncomingMessage, res: ServerResponse, config: HttpProxyConfig) {
  const proxyStatus: ProxyStatus = {ts: Date.now()};
  const {originData, handleInfoOfProxyReq, handleInfoOfRes2Origin, preRequestCb} = config;
  let reqInfo = handleRequestInfo(req, config);
  proxyStatus.requestInfo = reqInfo;
  if (handleInfoOfProxyReq) {
    const tmp = await handleInfoOfProxyReq(reqInfo.proxy);
    if (tmp) {
      reqInfo.proxy = tmp;
    }
  }
  const {href, protocol, requestOptions: proxyRequestOptions} = reqInfo.proxy;
  preRequestCb && preRequestCb(proxyStatus);
  const proxyReq = (protocol === 'https:' ? https : http).request(href, proxyRequestOptions);
  (originData ? toStream(originData) : req)
    .pipe(
      getDataByTransform(
        data => {
          proxyStatus.requestInfo.origin.data = data;
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
    const infoOfRes2Proxy = getResponseHeaderInfo(res2Proxy);
    let infoOfRes2Origin = deepClone(infoOfRes2Proxy);
    /** Rewrite cookie info */
    for (let [key, value] of Object.entries(infoOfRes2Origin.headers)) {
      let newValue = value;
      // if (key.toLowerCase() === 'set-cookie') {
      //   newValue = cookieRewrite(value, 'domain', '0.0.0.0');
      // }
      infoOfRes2Origin.headers[key] = newValue;
    }
    if (handleInfoOfRes2Origin) {
      const tmp = await handleInfoOfRes2Origin(infoOfRes2Origin);
      if (tmp) {
        infoOfRes2Origin = tmp;
      }
    }
    proxyStatus.responseInfo = {
      toProxy: infoOfRes2Proxy,
      toOrigin: infoOfRes2Origin,
    };
    const {httpVersion, statusCode, statusMessage, headers} = infoOfRes2Origin;
    res.statusCode = statusCode;
    res.statusMessage = statusMessage ?? '';
    for (const [key, value] of Object.entries(infoOfRes2Origin.headers)) {
      res.setHeader(key, value);
    }
    res2Proxy
      .pipe(
        getDataByTransform(
          data => {
            proxyStatus.responseInfo.toProxy.data = data;
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
