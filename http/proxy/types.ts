import {RequestOptions, IncomingMessage} from 'http';
import {toStream} from '../../stream';
import {HttpRequestOptions} from '../client';
import {TcpHttpRequestProps, TcpHttpResponseProps} from '../../types';

export interface HttpProxyConfig {
  /**
   * Target href can be passed here, or in handleInfoOfProxyReq.
   */
  targetHref?: string;
  /** Change headers.origin to origin value of targetHref */
  // changeOrigin?: boolean;
  /**
   * Use customized data other than request stream, use case:
   * 1. Program already got all original data to decide how to handle some logic, the req stream is alreay ended.
   */
  originData?: Parameters<typeof toStream>[0];
  /** Default options for http.request of proxy */
  defaultRequestOptions?: Pick<RequestOptions, 'auth'>;
  /** Handle info of proxy request before request in sent */
  handleInfoForProxyReq?: (
    info: HttpRequestOptions
  ) => Promise<HttpRequestOptions | void> | HttpRequestOptions | void;
  /**
   * Callback started just before proxy request start, use case:
   * 1. To collect proxyStatus
   * 1. To print proxy info
   */
  preProxyReq?: (proxyStatus: ProxyStatus) => void;

  /** Just on response to proxy */
  onRes2Proxy?: (info: TcpHttpResponseProps, proxyReqInfo: HttpRequestOptions, response: IncomingMessage) => void;
  /** Handle info of response to proxy */
  handleInfoOfRes2Origin?: (info: TcpHttpResponseProps) => Promise<TcpHttpResponseProps | void> | TcpHttpResponseProps | void;
}

export interface ProxyStatus {
  id?: string;
  ts: number;
  requestInfo?: {origin: TcpHttpRequestProps; proxy: HttpRequestOptions};
  responseInfo?: {
    toProxy: TcpHttpResponseProps;
    toOrigin: TcpHttpResponseProps;
  };
  err?: {
    message: Error['message'];
    stack: Error['stack'];
  };
}
