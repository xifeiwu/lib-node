import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {Socket} from 'net';
import {toUrlInstance, deepClone, getUrlPropsFromConfig, cookieRewrite, concatPath} from '../../external';
import {HttpProxyConfig, ProxyStatus} from './types';
import {
  toReadable,
  getDataByTransform,
  toBuffer,
  getHttpResponseHeaderPartInfo,
  httpRequestOptionsToCurlCommand,
  makeSureHttpRequestOptionsSerializable,
  validateStatusCode,
  getHttpRequestHeaderPartInfo,
  logColorful,
  mergeHttpRequestOptions,
} from './external';
import {HttpRequestOptions, HttpResponseHeaderPartInfo, HttpResponseInfo} from '../../types';

/**
 * After response to proxy: print more info when http status code is invalid.
 * @param _response
 * @param headerPart
 * @param proxyReq
 */
export function postResToProxy(
  _response: IncomingMessage,
  headerPart: HttpResponseHeaderPartInfo<'receiver'>,
  proxyReq: HttpRequestOptions
) {
  if (!validateStatusCode(headerPart)) {
    logColorful(
      {color: 'red'},
      makeSureHttpRequestOptionsSerializable(proxyReq),
      httpRequestOptionsToCurlCommand(proxyReq),
      headerPart
    );
  }
}

const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

function applyResponseHeaderRewrite(options: {
  infoOfRes2Origin: HttpResponseInfo;
  req: IncomingMessage;
  href: string;
  cookieDomainRewrite?: HttpProxyConfig['cookieDomainRewrite'];
  cookiePathRewrite?: HttpProxyConfig['cookiePathRewrite'];
  hostRewrite?: HttpProxyConfig['hostRewrite'];
  protocolRewrite?: HttpProxyConfig['protocolRewrite'];
}) {
  const {infoOfRes2Origin, req, href, cookieDomainRewrite, cookiePathRewrite, hostRewrite, protocolRewrite} =
    options;
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
}

function writeHttpResponseInfoToSocket(socket: Socket, info: HttpResponseInfo) {
  const statusLine = `HTTP/${info.httpVersion} ${info.statusCode} ${info.statusMessage ?? ''}\r\n`;
  const headers = Object.entries(info.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n');
  socket.write(statusLine + headers + '\r\n\r\n');
}

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
    postResToProxy,
    timeout,
    proxyTimeout,
    xfwd,
    changeOrigin,
    cookieDomainRewrite,
    cookiePathRewrite,
    hostRewrite,
    protocolRewrite,
    followRedirects,
    maxRedirects = 5,
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

  // if (globalRequestOptions?.pathname) {
  //   proxyReqInfo.pathname = concatPath(globalRequestOptions.pathname, originReqInfo.url);
  // }

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
      postResToProxy && postResToProxy(res2Proxy, infoOfRes2Proxy, proxyReqInfo);
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
    postResToProxy && postResToProxy(res2Proxy, infoOfRes2Proxy, proxyReqInfo);
    let infoOfRes2Origin = deepClone(infoOfRes2Proxy);

    applyResponseHeaderRewrite({
      infoOfRes2Origin,
      req,
      href,
      cookieDomainRewrite,
      cookiePathRewrite,
      hostRewrite,
      protocolRewrite,
    });

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
export async function proxyWebSocketRequest(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  config: HttpProxyConfig
) {
  const proxyStatus: ProxyStatus = {ts: Date.now()};
  const {
    globalRequestOptions,
    handleProxyRequestOptions,
    preProxyReq,
    handleResponseInfoToOrigin,
    postResToProxy,
    timeout,
    proxyTimeout,
    xfwd,
    changeOrigin,
    cookieDomainRewrite,
    cookiePathRewrite,
    hostRewrite,
    protocolRewrite,
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

  if (globalRequestOptions?.pathname) {
    proxyReqInfo.pathname = concatPath(globalRequestOptions.pathname, originReqInfo.url);
  }

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

  const proxyReq = (protocol === 'https:' || protocol === 'wss:' ? https : http).request(
    href,
    requestOptions
  );

  if (proxyTimeout) {
    proxyReq.setTimeout(proxyTimeout, () => {
      proxyReq.destroy();
      socket.end();
    });
  }

  proxyReq.on('error', err => {
    const error = err as NodeJS.ErrnoException;
    proxyStatus.err = {message: error.message, stack: error.stack, code: error.code};
    logColorful({color: 'red'}, `[ws proxy error] ${error.code || 'UNKNOWN'}: ${error.message}`);
    socket.end();
  });

  proxyReq.on('response', async res => {
    if (!res.headers.upgrade) {
      const infoOfRes2Proxy = getHttpResponseHeaderPartInfo(res);
      postResToProxy && postResToProxy(res, infoOfRes2Proxy, proxyReqInfo);
      let infoOfRes2Origin = deepClone(infoOfRes2Proxy);
      applyResponseHeaderRewrite({
        infoOfRes2Origin,
        req,
        href,
        cookieDomainRewrite,
        cookiePathRewrite,
        hostRewrite,
        protocolRewrite,
      });
      if (handleResponseInfoToOrigin) {
        const tmp = await handleResponseInfoToOrigin(infoOfRes2Origin);
        if (tmp) {
          infoOfRes2Origin = tmp;
        }
      }
      proxyStatus.responseInfo = {toProxy: infoOfRes2Proxy, toOrigin: infoOfRes2Origin};
      writeHttpResponseInfoToSocket(socket, infoOfRes2Origin);
      res.pipe(socket);
    }
  });

  proxyReq.on('upgrade', async (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', () => socket.end());
    socket.on('error', () => proxySocket.end());

    const infoOfRes2Proxy = getHttpResponseHeaderPartInfo(proxyRes);
    postResToProxy && postResToProxy(proxyRes, infoOfRes2Proxy, proxyReqInfo);
    let infoOfRes2Origin = deepClone(infoOfRes2Proxy);
    applyResponseHeaderRewrite({
      infoOfRes2Origin,
      req,
      href,
      cookieDomainRewrite,
      cookiePathRewrite,
      hostRewrite,
      protocolRewrite,
    });
    if (handleResponseInfoToOrigin) {
      const tmp = await handleResponseInfoToOrigin(infoOfRes2Origin);
      if (tmp) {
        infoOfRes2Origin = tmp;
      }
    }
    proxyStatus.responseInfo = {toProxy: infoOfRes2Proxy, toOrigin: infoOfRes2Origin};
    writeHttpResponseInfoToSocket(socket, infoOfRes2Origin);

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
