import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {toUrlInstance, deepClone, deepMerge, getUrlPropsFromConfig} from '../../external';
import {HttpProxyConfig, ProxyStatus} from './types';
import {toReadable, getDataByTransform} from '../../stream';
import {toBuffer} from '../../transform';
import {
  getHttpResponseHeaderPartInfo,
  httpRequestOptionsToCurlCommand,
  makeSureHttpRequestOptionsSerializable,
  validateStatusCode,
  getHttpRequestHeaderPartInfo,
} from './external';
import {logColorful} from '../../log';
import {HttpRequestOptions, HttpResponseInfo} from '../../types';
import {mergeHttpRequestOptions} from '../../http';

/**
 * On response to proxy: print more info when http status code is invalid.
 * @param resInfo
 * @param proxyReq
 */
export function onRes2Proxy(resInfo: HttpResponseInfo, proxyReq: HttpRequestOptions) {
  if (!validateStatusCode(resInfo)) {
    logColorful(
      {color: 'red'},
      makeSureHttpRequestOptionsSerializable(proxyReq),
      httpRequestOptionsToCurlCommand(proxyReq),
      resInfo
    );
  }
}

/**
 * Custmoiziable Request Proxy.
 * +--------+                                     +-------+                                     +--------+
 * |        |                                     |       |      handleInfoForProxyReq          |        |
 * |        | -----------originRequest----------> |       | -----------proxyRequest-----------> |        |
 * | Origin |                                     | Proxy |                                     | Target |
 * |        |   handleRes2OriginInfo,             |       |                                     |        |
 * |        | <---------response2Origin---------- |       | <---------response2Proxy----------- |        |
 * +--------+                                     +-------+                                     +--------+
 */
export async function proxyHttpRequest(req: IncomingMessage, res: ServerResponse, config: HttpProxyConfig) {
  const proxyStatus: ProxyStatus = {ts: Date.now()};
  const {
    globalRequestOptions,
    originData,
    handleProxyRequestOptions,
    preProxyReq,
    handleResponseInfoToOrigin,
    onRes2Proxy,
  } = config;
  const originReqInfo = getHttpRequestHeaderPartInfo(req);
  let proxyReqInfo: HttpRequestOptions = mergeHttpRequestOptions(
    {
      pathname: originReqInfo.url,
      method: originReqInfo.method,
      headers: originReqInfo.headers,
    },
    globalRequestOptions
  );

  if (handleProxyRequestOptions) {
    const tmp = await handleProxyRequestOptions(proxyReqInfo);
    if (tmp) {
      proxyReqInfo = tmp;
    }
  }
  proxyStatus.requestInfo = {origin: originReqInfo, proxy: proxyReqInfo};

  const {urlProps, restProps} = getUrlPropsFromConfig(proxyReqInfo);
  const {data, ...requestOptions} = restProps;
  const {protocol, href} = toUrlInstance(urlProps);
  preProxyReq && preProxyReq(proxyStatus, {href});
  const proxyReq = (protocol === 'https:' ? https : http).request(href, requestOptions);

  (originData ? toReadable(originData) : req)
    .pipe(
      getDataByTransform(
        data => {
          proxyReqInfo.data = data;
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
    const infoOfRes2Proxy = getHttpResponseHeaderPartInfo(res2Proxy);
    onRes2Proxy && onRes2Proxy(infoOfRes2Proxy, proxyReqInfo, res2Proxy);
    let infoOfRes2Origin = deepClone(infoOfRes2Proxy);
    /** Rewrite cookie info */
    for (const [key, value] of Object.entries(infoOfRes2Origin.headers)) {
      const newValue = value;
      // if (key.toLowerCase() === 'set-cookie') {
      //   newValue = cookieRewrite(value, 'domain', '0.0.0.0');
      // }
      infoOfRes2Origin.headers[key] = newValue;
    }
    if (handleResponseInfoToOrigin) {
      const tmp = await handleResponseInfoToOrigin(infoOfRes2Origin);
      if (tmp) {
        infoOfRes2Origin = tmp;
      }
    }
    proxyStatus.responseInfo = {
      toProxy: infoOfRes2Proxy,
      toOrigin: infoOfRes2Origin,
    };
    const {httpVersion, statusCode, statusMessage} = infoOfRes2Origin;
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
    console.log(err);
    res.statusCode = 500;
    res.statusMessage = 'Error, proxyHandler error';
    const {message, stack} = err as Error;
    const errorInfo = {message, stack};
    proxyStatus.err = errorInfo;
    if (res.writable) {
      res.end(toBuffer(errorInfo));
    }
  }
}
