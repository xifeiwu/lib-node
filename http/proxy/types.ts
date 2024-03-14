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
  /** Change headers.origin to origin of targetHref */
  changeOrigin?: boolean;
  /** Options for proxy request */
  proxyRequestOptions?: Pick<RequestOptions, 'auth'>;
  /** Handle info of proxy request before request in sent */
  handleProxyReqInfo?: (info: ProxyRequestInfo) => Promise<ProxyRequestInfo | void> | ProxyRequestInfo | void;
  // handleProxyReqError?: (err: Error) => void;
  /** callback before proxy request start */
  preRequestCb?: (reqInfo: ProxyStatus) => void;

  /** Handle info of response to proxy */
  handleRes2ProxyInfo?: (info: ResponseInfo) => ResponseInfo | void;
}

export interface ProxyStatus {
  id?: string;
  ts: number;
  request?: {origin: RequestInfo; proxy: ProxyRequestInfo};
  response?: {
    toProxy: ResponseInfo;
    toOrigin: ResponseInfo;
  };
  err?: {
    message: Error['message'];
    stack: Error['stack'];
  };
}
