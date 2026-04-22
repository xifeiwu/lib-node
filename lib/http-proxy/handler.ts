import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {toUrlInstance, deepClone, getUrlPropsFromConfig, cookieRewrite} from '../../external';
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
    timeout,
    proxyTimeout,
    xfwd,
    changeOrigin,
    cookieDomainRewrite,
    cookiePathRewrite,
  } = config;

  if (timeout && req.socket) {
    req.socket.setTimeout(timeout);
  }

  const originReqInfo = getHttpRequestHeaderPartInfo(req);
  let proxyReqInfo: HttpRequestOptions = mergeHttpRequestOptions(
    {
      pathname: originReqInfo.url,
      method: originReqInfo.method,
      headers: originReqInfo.headers,
    },
    globalRequestOptions
  );

  if (xfwd && req.socket) {
    const headers = proxyReqInfo.headers || {};
    const existingFor = headers['x-forwarded-for'] as string;
    const clientIp = req.socket.remoteAddress;
    headers['x-forwarded-for'] = existingFor ? `${existingFor}, ${clientIp}` : clientIp;
    headers['x-forwarded-port'] = String(req.socket.localPort);
    headers['x-forwarded-proto'] = (req.socket as any).encrypted ? 'https' : 'http';
    headers['x-forwarded-host'] = req.headers.host;
    proxyReqInfo.headers = headers;
  }

  if (handleProxyRequestOptions) {
    const tmp = await handleProxyRequestOptions(proxyReqInfo);
    if (tmp) {
      proxyReqInfo = tmp;
    }
  }
  proxyStatus.requestInfo = {origin: originReqInfo, proxy: proxyReqInfo};

  const {urlProps, restProps} = getUrlPropsFromConfig(proxyReqInfo);
  const {data, ...requestOptions} = restProps;
  const {protocol, href, hostname, port} = toUrlInstance(urlProps);

  if (changeOrigin) {
    const headers = proxyReqInfo.headers || {};
    headers.host = port ? `${hostname}:${port}` : hostname;
    proxyReqInfo.headers = headers;
    if (requestOptions.headers) {
      requestOptions.headers.host = headers.host;
    }
  }
  preProxyReq && preProxyReq(proxyStatus, {href});
  const proxyReq = (protocol === 'https:' ? https : http).request(href, requestOptions);

  if (proxyTimeout) {
    proxyReq.setTimeout(proxyTimeout, () => {
      proxyReq.destroy(new Error(`Proxy request timeout after ${proxyTimeout}ms`));
    });
  }

  req.on('close', () => {
    if (!proxyReq.destroyed) {
      proxyReq.destroy();
    }
  });

  (originData ? toReadable(originData) : req)
    .pipe(
      getDataByTransform(
        ({data}) => {
          if (data) {
            proxyReqInfo.data = data;
          }
        },
        {
          targetType: 'json',
          maxSize: 1024 * 1024,
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
    for (const [key, value] of Object.entries(infoOfRes2Origin.headers)) {
      if (key.toLowerCase() === 'set-cookie') {
        let rewritten = value;
        if (cookieDomainRewrite !== undefined) {
          rewritten = cookieRewrite(rewritten, 'domain', cookieDomainRewrite);
        }
        if (cookiePathRewrite !== undefined) {
          rewritten = cookieRewrite(rewritten, 'path', cookiePathRewrite);
        }
        infoOfRes2Origin.headers[key] = rewritten;
      }
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
          ({data}) => {
            proxyStatus.responseInfo.toProxy.data = data;
          },
          {
            targetType: 'json',
          }
        )
      )
      .pipe(res);
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    const {message, stack, code} = error;
    const errorInfo = {message, stack, code};
    proxyStatus.err = errorInfo;

    if (code === 'ECONNRESET' && req.socket?.destroyed) {
      return;
    }

    const statusByCode: Record<string, number> = {
      ECONNREFUSED: 502,
      ETIMEDOUT: 504,
      ENOTFOUND: 502,
      EHOSTUNREACH: 502,
    };
    const statusCode = statusByCode[code] || 500;

    logColorful({color: 'red'}, `[proxy error] ${code || 'UNKNOWN'}: ${message}`);

    if (res.writable && !res.headersSent) {
      res.statusCode = statusCode;
      res.statusMessage = code ? `Proxy ${code}` : 'Proxy Error';
      res.end(toBuffer(errorInfo));
    }
  }
}
