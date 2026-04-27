import https from 'https';
import http, {IncomingMessage} from 'http';
import {Socket} from 'net';
import {toUrlInstance, deepClone, getUrlPropsFromConfig, cookieRewrite} from '../../../external';
import {HttpProxyConfig, ProxyStatus} from '../types';
import {
  getHttpResponseHeaderPartInfo,
  httpRequestOptionsToCurlCommand,
  makeSureHttpRequestOptionsSerializable,
  validateStatusCode,
  getHttpRequestHeaderPartInfo,
  logColorful,
  mergeHttpRequestOptions,
} from '../external';
import {HttpRequestOptions, HttpResponseHeaderPartInfo, HttpResponseInfo} from '../../../types';

export const REDIRECT_STATUS_CODES = [301, 302, 303, 307, 308];

export interface PreparedProxyRequest {
  proxyStatus: ProxyStatus;
  urlInst: URL;
  /**
   * contains all request info
   */
  proxyReqInfo: HttpRequestOptions;
  /**
   * contains all request options(excluding url props)
   */
  requestOptions: http.RequestOptions;
  data: any;
}

/**
 * After response to proxy: print more info when http status code is invalid.
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

/**
 * Priority (highest to lowest): xfwd & changeOrigin > config.handleProxyRequestOptions hook > globalRequestOptions
 */
export async function processProxyRequest(
  req: IncomingMessage,
  config: HttpProxyConfig,
  options: {protocolType: 'http' | 'ws'; proxyStatus?: ProxyStatus}
): Promise<PreparedProxyRequest> {
  const {globalRequestOptions, timeout, xfwd, changeOrigin} = config;
  const {protocolType, proxyStatus = {ts: Date.now()}} = options;

  if (timeout && req.socket) {
    req.socket.setTimeout(timeout);
  }

  const originReqInfo = getHttpRequestHeaderPartInfo(req);

  // 1. globalRequestOptions — lowest priority
  const proxyReqInfo: HttpRequestOptions = mergeHttpRequestOptions(
    {
      pathname: originReqInfo.url,
      method: originReqInfo.method,
      headers: originReqInfo.headers,
    },
    globalRequestOptions
  );

  // 2. config.handleProxyRequestOptions hook — middle priority
  if (config.handleProxyRequestOptions) {
    const tmp = await config.handleProxyRequestOptions(proxyReqInfo);
    if (tmp) {
      Object.assign(proxyReqInfo, tmp);
    }
  }

  // 3. URL resolution
  const {urlProps, restProps} = getUrlPropsFromConfig(proxyReqInfo);
  const {data, ...requestOptions} = restProps;
  let urlInst = toUrlInstance(urlProps);
  const headers = proxyReqInfo.headers ?? {};
  proxyReqInfo.headers = headers;
  requestOptions.headers = headers;

  // 4. urlRewrite — highest priority
  if (config.urlRewrite) {
    urlInst = await config.urlRewrite(urlInst);
  }

  // 5. xfwd — highest priority
  if (xfwd && req.socket) {
    const existingFor = headers['x-forwarded-for'] as string;
    const clientIp = req.socket.remoteAddress;
    headers['x-forwarded-for'] = existingFor ? `${existingFor}, ${clientIp}` : clientIp;
    headers['x-forwarded-port'] = String(req.socket.localPort);
    headers['x-forwarded-host'] = req.headers.host;
    const protoMap = {http: 'http', ws: 'ws'} as const;
    headers['x-forwarded-proto'] = (req.socket as any).encrypted
      ? `${protoMap[protocolType]}s`
      : protoMap[protocolType];
  }

  // 6. changeOrigin — highest priority
  if (changeOrigin) {
    headers.host = urlInst.port ? `${urlInst.hostname}:${urlInst.port}` : urlInst.hostname;
  }

  proxyStatus.requestInfo = {origin: originReqInfo, proxy: proxyReqInfo};

  return {proxyStatus, proxyReqInfo, urlInst, requestOptions, data};
}

export interface ProcessedResponse {
  targetResInfo: HttpResponseHeaderPartInfo<'receiver'>;
  proxyResInfo: HttpResponseInfo;
}

/**
 * Priority (highest to lowest): cookieDomainRewrite & cookiePathRewrite > handleResponseInfoToOrigin hook
 */
export async function processProxyResponse(
  res2Proxy: IncomingMessage,
  config: HttpProxyConfig,
  options: {proxyReqInfo: HttpRequestOptions; proxyStatus: ProxyStatus; req: IncomingMessage; href: string}
): Promise<ProcessedResponse> {
  const {proxyReqInfo, proxyStatus, req, href} = options;
  const {
    postResToProxy: postResToProxyCb,
    handleResponseInfoToOrigin,
    cookieDomainRewrite,
    cookiePathRewrite,
    hostRewrite,
    protocolRewrite,
  } = config;

  const targetResInfo = getHttpResponseHeaderPartInfo(res2Proxy);
  postResToProxyCb && postResToProxyCb(res2Proxy, targetResInfo, proxyReqInfo);
  let proxyResInfo = deepClone(targetResInfo);

  // 1. handleResponseInfoToOrigin hook — lower priority
  if (handleResponseInfoToOrigin) {
    const tmp = await handleResponseInfoToOrigin(proxyResInfo);
    if (tmp) {
      proxyResInfo = tmp;
    }
  }

  // 2. applyResponseHeaderRewrite (cookie/host/protocol) — higher priority
  applyResponseHeaderRewrite({
    proxyResInfo,
    req,
    href,
    cookieDomainRewrite,
    cookiePathRewrite,
    hostRewrite,
    protocolRewrite,
  });

  proxyStatus.responseInfo = {fromTarget: targetResInfo, fromProxy: proxyResInfo};

  return {targetResInfo, proxyResInfo};
}

function applyResponseHeaderRewrite(options: {
  proxyResInfo: HttpResponseInfo;
  req: IncomingMessage;
  href: string;
  cookieDomainRewrite?: HttpProxyConfig['cookieDomainRewrite'];
  cookiePathRewrite?: HttpProxyConfig['cookiePathRewrite'];
  hostRewrite?: HttpProxyConfig['hostRewrite'];
  protocolRewrite?: HttpProxyConfig['protocolRewrite'];
}) {
  const {proxyResInfo, req, href, cookieDomainRewrite, cookiePathRewrite, hostRewrite, protocolRewrite} =
    options;
  for (const [key, value] of Object.entries(proxyResInfo.headers)) {
    if (key.toLowerCase() === 'set-cookie') {
      let rewritten = value;
      if (cookieDomainRewrite !== undefined) {
        rewritten = cookieRewrite(rewritten, 'domain', cookieDomainRewrite);
      }
      if (cookiePathRewrite !== undefined) {
        rewritten = cookieRewrite(rewritten, 'path', cookiePathRewrite);
      }
      proxyResInfo.headers[key] = rewritten;
    }
  }

  if (
    REDIRECT_STATUS_CODES.includes(proxyResInfo.statusCode) &&
    proxyResInfo.headers.location &&
    (hostRewrite || protocolRewrite)
  ) {
    const locationUrl = new URL(proxyResInfo.headers.location as string, href);
    if (hostRewrite) {
      locationUrl.host = hostRewrite === true ? req.headers.host : hostRewrite;
    }
    if (protocolRewrite) {
      locationUrl.protocol = protocolRewrite.endsWith(':') ? protocolRewrite : `${protocolRewrite}:`;
    }
    proxyResInfo.headers.location = locationUrl.href;
  }
}

export function writeHttpResponseInfoToSocket(socket: Socket, info: HttpResponseInfo) {
  const statusLine = `HTTP/${info.httpVersion} ${info.statusCode} ${info.statusMessage ?? ''}\r\n`;
  const headers = Object.entries(info.headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n');
  socket.write(statusLine + headers + '\r\n\r\n');
}

export function issueRequestWithRedirects(
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
