import {RequestOptions, IncomingMessage} from 'http';
import {toReadable} from '../../stream';
import {HttpRequestInfo, HttpResponseInfo, HttpRequestOptions} from '../../types';

export interface HttpProxyConfig {
  /**
   * global options for http.request of proxy, will merge with info from request to proxy
   */
  globalRequestOptions?: Partial<HttpRequestOptions>;
  /** Change headers.origin to origin value of targetHref */
  // changeOrigin?: boolean;
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

  /** Just on response to proxy */
  onRes2Proxy?: (info: HttpResponseInfo, proxyReqInfo: HttpRequestOptions, response: IncomingMessage) => void;
  /** Handle info of response to proxy */
  handleResponseInfoToOrigin?: (
    info: HttpResponseInfo
  ) => Promise<HttpResponseInfo | void> | HttpResponseInfo | void;
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
  };
}
