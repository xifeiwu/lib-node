import {RequestOptions} from 'http';
import {RequestInfo, ResponseInfo} from '../common';
import {toStream} from '../../stream';

export interface ProxyRequestInfo {
  href: string;
  protocol: 'https:' | 'http:' | string;
  requestOptions: RequestOptions;
}

export interface AllRequestInfo {
  origin: RequestInfo;
  proxy: ProxyRequestInfo;
}

export interface HttpProxyConfig {
  targetHref: string;
  /** Change headers.origin to origin value of targetHref */
  changeOrigin?: boolean;
  /**
   * Use customized data other than request stream, use case:
   * 1. Program already got all original data to decide how to handle some logic, the req stream is alreay ended.
   */
  originData?: Parameters<typeof toStream>[0];
  /** Options for http.request of proxy */
  proxyRequestOptions?: Pick<RequestOptions, 'auth'>;
  /** Handle info of proxy request before request in sent */
  handleInfoOfProxyReq?: (
    info: ProxyRequestInfo
  ) => Promise<ProxyRequestInfo | void> | ProxyRequestInfo | void;
  /**
   * Callback just before proxy request start, use case:
   * 1. To collect proxyStatus
   * 1. To print proxy info
   */
  preRequestCb?: (proxyStatus: ProxyStatus) => void;

  /** Handle info of response to proxy */
  handleInfoOfRes2Origin?: (info: ResponseInfo) => ResponseInfo | void;
}

export interface ProxyStatus {
  id?: string;
  ts: number;
  requestInfo?: {origin: RequestInfo; proxy: ProxyRequestInfo};
  responseInfo?: {
    toProxy: ResponseInfo;
    toOrigin: ResponseInfo;
  };
  err?: {
    message: Error['message'];
    stack: Error['stack'];
  };
}
