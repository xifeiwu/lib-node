import http, {IncomingMessage, RequestOptions, ServerResponse} from 'http';
import https from 'https';
import {ResponseInfo, getRequestHeaderInfo, getResponseHeaderInfo} from '../common';
import {concatPath} from '../../fe';
import {startHttpServer} from '../server';

export interface ProxyRequestInfo {
  href: string;
  protocol: 'https:' | 'http:' | string;
  requestOptions: RequestOptions;
}
export interface HttpProxyConfig {
  targetHref: string;
  changeOrigin?: boolean;
  defaultRequestOptions?: Pick<RequestOptions, 'auth'>;
  handleProxyReqInfo?: (info: ProxyRequestInfo) => ProxyRequestInfo | void;
  handleProxyReqError?: (err: Error) => void;
  handleProxyResInfo?: (info: ResponseInfo) => ResponseInfo | void;
}

function getProxyRequestInfo(req: IncomingMessage, config: HttpProxyConfig): ProxyRequestInfo {
  const {targetHref, changeOrigin = true, defaultRequestOptions = {}} = config;
  const {protocol, origin, host, pathname} = new URL(targetHref);
  const {method, url, headers} = getRequestHeaderInfo(req);
  const href = origin + concatPath('/', pathname, url);
  if (headers.host && changeOrigin) {
    headers.host = host;
  }
  return {
    href,
    protocol,
    requestOptions: {
      method,
      headers,
      ...defaultRequestOptions,
    },
  };
}

function cookieRewrite(value, property: 'domain' | 'path', newValue: string) {
  if (Array.isArray(value)) {
    return value.map(it => {
      return cookieRewrite(it, property, newValue);
    });
  }

  return value.replace(
    new RegExp('(;\\s*' + property + '=)([^;]+)', 'i'),
    function (match, prefix, previousValue) {
      // var newValue;
      // if (previousValue in config) {
      //   newValue = config[previousValue];
      // } else if ('*' in config) {
      //   newValue = config['*'];
      // } else {
      //   //no match, return previous value
      //   return match;
      // }
      if (newValue) {
        //replace value
        return prefix + newValue;
      } else {
        //remove value
        return '';
      }
    }
  );
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse, config: HttpProxyConfig) {
  const {handleProxyReqError, handleProxyReqInfo, handleProxyResInfo} = config;
  let proxyReqInfo = getProxyRequestInfo(req, config);
  if (handleProxyReqInfo) {
    const tmp = handleProxyReqInfo(proxyReqInfo);
    if (tmp) {
      proxyReqInfo = tmp;
    }
  }
  const {href, protocol, requestOptions: proxyRequestOptions} = proxyReqInfo;
  const proxyReq = (protocol === 'https:' ? https : http).request(href, proxyRequestOptions);
  req.pipe(proxyReq);
  proxyReq.on('error', err => {
    if (handleProxyReqError) {
      handleProxyReqError(err);
    } else {
      console.log(err);
    }
  });
  proxyReq.on('response', res2Proxy => {
    let proxyResInfo = getResponseHeaderInfo(res2Proxy);
    if (handleProxyResInfo) {
      const tmp = handleProxyResInfo(proxyResInfo);
      if (tmp) {
        proxyResInfo = tmp;
      }
    }
    const {httpVersion, statusCode, statusMessage, headers} = proxyResInfo;
    res.statusCode = statusCode;
    res.statusMessage = statusMessage ?? '';
    for (let [key, value] of Object.entries(headers)) {
      // console.log(`key, value`);
      // console.log(key, value);
      let newValue = value;
      if (key.toLowerCase() === 'set-cookie') {
        newValue = cookieRewrite(value, 'domain', '0.0.0.0');
      }
      res.setHeader(key, newValue);
    }
    res2Proxy.pipe(res);
  });
}

export async function startProxyServer(config: HttpProxyConfig) {
  return startHttpServer({
    request: (req, res) => handleRequest(req, res, config),
  });
}
