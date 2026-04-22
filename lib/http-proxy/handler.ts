import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';
import {toUrlInstance, deepClone, getUrlPropsFromConfig, cookieRewrite, concatPath} from '../../external';
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

const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

function issueRequestWithRedirects(
  href: string,
  requestOptions: http.RequestOptions,
  protocol: string,
  maxRedirects: number,
  redirectCount = 0
): Promise<http.IncomingMessage> {
  if (redirectCount > maxRedirects) {
    return Promise.reject(new Error(`Too many redirects (max ${maxRedirects})`));
  }
  return new Promise<http.IncomingMessage>((resolve, reject) => {
    const proxyReq = (protocol === 'https:' ? https : http).request(href, requestOptions, res2Proxy => {
      if (REDIRECT_STATUS_CODES.includes(res2Proxy.statusCode) && res2Proxy.headers.location) {
        res2Proxy.resume();
        const location = res2Proxy.headers.location;
        const redirectUrl = new URL(location, href);
        const newProtocol = redirectUrl.protocol;
        const newHref = redirectUrl.href;
        const newOptions = {...requestOptions};
        if ([301, 302, 303].includes(res2Proxy.statusCode)) {
          newOptions.method = 'GET';
          delete newOptions.headers?.['content-length'];
          delete newOptions.headers?.['content-type'];
        }
        if (redirectUrl.host !== new URL(href).host) {
          delete newOptions.headers?.['authorization'];
          delete newOptions.headers?.['cookie'];
        }
        resolve(issueRequestWithRedirects(newHref, newOptions, newProtocol, maxRedirects, redirectCount + 1));
        return;
      }
      resolve(res2Proxy);
    });
    proxyReq.on('error', reject);
    proxyReq.end();
  });
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
    hostRewrite,
    protocolRewrite,
    prependPath = true,
    ignorePath,
    followRedirects,
    maxRedirects = 5,
  } = config;

  if (timeout && req.socket) {
    req.socket.setTimeout(timeout);
  }

  const originReqInfo = getHttpRequestHeaderPartInfo(req);

  let requestPathname = originReqInfo.url;
  if (ignorePath) {
    requestPathname = '';
  }

  let proxyReqInfo: HttpRequestOptions = mergeHttpRequestOptions(
    {
      pathname: requestPathname,
      method: originReqInfo.method,
      headers: originReqInfo.headers,
    },
    globalRequestOptions
  );

  if (prependPath && globalRequestOptions?.pathname) {
    proxyReqInfo.pathname = concatPath(globalRequestOptions.pathname, ignorePath ? '' : originReqInfo.url);
  }

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

  if (followRedirects) {
    try {
      const res2Proxy = await issueRequestWithRedirects(href, requestOptions, protocol, maxRedirects);
      const infoOfRes2Proxy = getHttpResponseHeaderPartInfo(res2Proxy);
      onRes2Proxy && onRes2Proxy(infoOfRes2Proxy, proxyReqInfo, res2Proxy);
      let infoOfRes2Origin = deepClone(infoOfRes2Proxy);
      if (handleResponseInfoToOrigin) {
        const tmp = await handleResponseInfoToOrigin(infoOfRes2Origin);
        if (tmp) {
          infoOfRes2Origin = tmp;
        }
      }
      proxyStatus.responseInfo = {toProxy: infoOfRes2Proxy, toOrigin: infoOfRes2Origin};
      res.statusCode = infoOfRes2Origin.statusCode;
      res.statusMessage = infoOfRes2Origin.statusMessage ?? '';
      for (const [key, value] of Object.entries(infoOfRes2Origin.headers)) {
        res.setHeader(key, value);
      }
      res2Proxy.pipe(res);
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      proxyStatus.err = {message: error.message, stack: error.stack, code: error.code};
      logColorful({color: 'red'}, `[proxy error] ${error.code || 'UNKNOWN'}: ${error.message}`);
      if (res.writable && !res.headersSent) {
        res.statusCode = 502;
        res.statusMessage = 'Proxy Redirect Error';
        res.end(toBuffer({message: error.message, stack: error.stack}));
      }
    }
    return;
  }

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

    if (
      REDIRECT_STATUS_CODES.includes(infoOfRes2Origin.statusCode) &&
      infoOfRes2Origin.headers.location &&
      (hostRewrite || protocolRewrite)
    ) {
      const locationUrl = new URL(infoOfRes2Origin.headers.location as string, href);
      if (hostRewrite) {
        locationUrl.host = hostRewrite === true ? req.headers.host : hostRewrite;
      }
      if (protocolRewrite) {
        locationUrl.protocol = protocolRewrite.endsWith(':') ? protocolRewrite : `${protocolRewrite}:`;
      }
      infoOfRes2Origin.headers.location = locationUrl.href;
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

/**
 * Proxy WebSocket upgrade requests to the target server.
 */
export function proxyWebSocketRequest(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  config: HttpProxyConfig
) {
  const {globalRequestOptions, xfwd, changeOrigin, proxyTimeout} = config;

  const originReqInfo = getHttpRequestHeaderPartInfo(req);
  const proxyReqInfo: HttpRequestOptions = mergeHttpRequestOptions(
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
    headers['x-forwarded-proto'] = (req.socket as any).encrypted ? 'wss' : 'ws';
    headers['x-forwarded-host'] = req.headers.host;
    proxyReqInfo.headers = headers;
  }

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

  const proxyReq = (protocol === 'https:' || protocol === 'wss:' ? https : http).request(href, requestOptions);

  if (proxyTimeout) {
    proxyReq.setTimeout(proxyTimeout, () => {
      proxyReq.destroy();
      socket.end();
    });
  }

  proxyReq.on('error', err => {
    logColorful({color: 'red'}, `[ws proxy error] ${(err as NodeJS.ErrnoException).code || 'UNKNOWN'}: ${err.message}`);
    socket.end();
  });

  proxyReq.on('response', res => {
    if (!res.headers.upgrade) {
      const statusLine = `HTTP/${res.httpVersion} ${res.statusCode} ${res.statusMessage}\r\n`;
      const headers = Object.entries(res.headers)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n');
      socket.write(statusLine + headers + '\r\n\r\n');
      res.pipe(socket);
    }
  });

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', () => socket.end());
    socket.on('error', () => proxySocket.end());

    const statusLine = `HTTP/${proxyRes.httpVersion} 101 Switching Protocols\r\n`;
    const headers = Object.entries(proxyRes.headers)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\r\n');
    socket.write(statusLine + headers + '\r\n\r\n');

    if (proxyHead && proxyHead.length) {
      socket.write(proxyHead);
    }

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.end();

  if (head && head.length) {
    proxyReq.write(head);
  }

  socket.on('close', () => {
    if (!proxyReq.destroyed) {
      proxyReq.destroy();
    }
  });
}
