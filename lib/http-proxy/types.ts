import {RequestOptions, IncomingMessage} from 'http';
import {toReadable} from '../../stream';
import {
  HttpRequestInfo,
  HttpResponseInfo,
  HttpRequestOptions,
  HttpResponseHeaderPartInfo,
  CanTransfromBetweenBuffer,
} from '../../types';

export interface HttpProxyConfig {
  /**
   * global options for http.request of proxy, will merge with info from request to proxy
   */
  globalRequestOptions?: Partial<HttpRequestOptions>;
  /**
   * Use customized data other than request stream, use case:
   * 1. Program already got all original data to decide how to handle some logic, the req stream is alreay ended.
   */
  originData?: Parameters<typeof toReadable>[0];
  /**
   * Handle httpRequestOptions before proxy send request to target
   */
  handleProxyRequestOptions?: (
    info: HttpRequestOptions
  ) => Promise<HttpRequestOptions | void> | HttpRequestOptions | void;
  /**
   * Callback started just before proxy request start, use case:
   * 1. To collect proxyStatus
   * 1. To print proxy info
   */
  preProxyReq?: (proxyStatus: ProxyStatus, moreInfo: {href: string}) => void;

  /** After response from target is available at the proxy (before forwarding to the client) */
  postResToProxy?: (
    response: IncomingMessage,
    headerPart: HttpResponseHeaderPartInfo<'receiver'>,
    proxyReqInfo: HttpRequestOptions
  ) => void;
  /** Handle info of response to proxy */
  handleResponseInfoToOrigin?: (
    info: HttpResponseInfo
  ) => Promise<HttpResponseInfo | void> | HttpResponseInfo | void;

  /** Timeout in ms for the incoming request socket */
  timeout?: number;
  /** Timeout in ms for the outgoing proxy request, aborts if exceeded */
  proxyTimeout?: number;

  /** Add x-forwarded-for, x-forwarded-port, x-forwarded-proto, x-forwarded-host headers */
  xfwd?: boolean;
  /** Rewrite Host header to match the target URL */
  changeOrigin?: boolean;
  /**
   * Rewrite Set-Cookie domain attribute.
   * - string: replace all domains with this value
   * - object: map from original domain to new domain, '*' as wildcard key
   */
  cookieDomainRewrite?: string | Record<string, string>;
  /**
   * Rewrite Set-Cookie path attribute.
   * - string: replace all paths with this value
   * - object: map from original path to new path, '*' as wildcard key
   */
  cookiePathRewrite?: string | Record<string, string>;

  /** Enable WebSocket proxying (listens for 'upgrade' event on the server) */
  ws?: boolean;
  /**
   * Rewrite the Location header on redirect responses (301/302/307/308).
   * - true: rewrite to match the original request's Host
   * - string: rewrite to this specific host
   */
  hostRewrite?: boolean | string;
  /** Force the protocol in rewritten Location headers (e.g. 'https') */
  protocolRewrite?: string;
  /** Prepend the target's pathname to the request path (default: true) */
  prependPath?: boolean;
  /** Follow redirects from the target server instead of passing them through (method B) */
  followRedirects?: boolean;
  /** Max number of redirects to follow (default: 5) */
  maxRedirects?: number;
}

interface MoreProxyRequestInfo {
  bytesWritten?: number;
  data?: CanTransfromBetweenBuffer;
}
interface MoreResponseToProxyInfo {
  bytesRead?: number;
  data?: CanTransfromBetweenBuffer;
}

export interface ProxyStatus {
  id?: string;
  ts: number;
  requestInfo?: {origin: HttpRequestInfo; proxy: HttpRequestOptions};
  responseInfo?: {
    toProxy: HttpResponseInfo;
    toOrigin: HttpResponseInfo;
  };
  err?: {
    message: Error['message'];
    stack: Error['stack'];
    code?: string;
  };
}
