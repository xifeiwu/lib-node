import {RequestOptions} from 'http';
import {RequestInfo, ResponseInfo} from '../common';

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
  /** Options for http.request of proxy */
  proxyRequestOptions?: Pick<RequestOptions, 'auth'>;
  /** Handle info of proxy request before request in sent */
  handleInfoOfProxyReq?: (info: ProxyRequestInfo) => Promise<ProxyRequestInfo | void> | ProxyRequestInfo | void;
  /** callback just before proxy request start(can be used to print proxy info) */
  preRequestCb?: (reqInfo: ProxyStatus) => void;

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
