import https from 'https';
import http, {IncomingMessage, ServerResponse} from 'http';
import {HttpProxyConfig, ProxyStatus} from '../types';
import {toReadable, getDataByTransform, toBuffer, logColorful} from '../external';
import {processProxyRequest, processProxyResponse, issueRequestWithRedirects} from './common';

export async function proxyHttpRequest(req: IncomingMessage, res: ServerResponse, config: HttpProxyConfig) {
  const {originData, proxyTimeout, followRedirects, maxRedirects = 5} = config;

  const proxyStatus: ProxyStatus = {ts: Date.now()};
  const {proxyReqInfo, urlInst, requestOptions} = await processProxyRequest(req, config, {
    protocolType: 'http',
    proxyStatus,
  });
  const {href, protocol} = urlInst;

  config.preProxyReq?.(proxyStatus, {href});

  const processOptions = {proxyReqInfo, proxyStatus, req, href};

  if (followRedirects) {
    try {
      const res2Proxy = await issueRequestWithRedirects(href, requestOptions, protocol, maxRedirects);
      const {proxyResInfo} = await processProxyResponse(res2Proxy, config, processOptions);
      res.statusCode = proxyResInfo.statusCode;
      res.statusMessage = proxyResInfo.statusMessage ?? '';
      for (const [key, value] of Object.entries(proxyResInfo.headers)) {
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
    if (!proxyReq.destroyed && req.socket?.destroyed) {
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
    const res2Proxy = await new Promise<http.IncomingMessage>((resolve, reject) => {
      proxyReq.on('error', reject);
      proxyReq.on('response', resolve);
    });

    const {proxyResInfo} = await processProxyResponse(res2Proxy, config, processOptions);

    res.statusCode = proxyResInfo.statusCode;
    res.statusMessage = proxyResInfo.statusMessage ?? '';
    for (const [key, value] of Object.entries(proxyResInfo.headers)) {
      res.setHeader(key, value);
    }
    res2Proxy
      .pipe(
        getDataByTransform(
          ({data}) => {
            proxyStatus.responseInfo.fromTarget.data = data;
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
