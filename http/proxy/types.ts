import {RequestOptions} from 'http';
import {RequestInfo, ResponseInfo} from '../common';

export interface ProxyRequestInfo {
  href: string;
  protocol: 'https:' | 'http:' | string;
  requestOptions: RequestOptions;
}
export interface HttpProxyConfig {
  targetHref: string;
  /** Change headers.origin to origin of targetHref */
  changeOrigin?: boolean;
  /** Options for proxy request */
  proxyRequestOptions?: Pick<RequestOptions, 'auth'>;
  /** Handle info of proxy request before request in sent */
  handleProxyReqInfo?: (info: ProxyRequestInfo) => Promise<ProxyRequestInfo | void>;
  // handleProxyReqError?: (err: Error) => void;

  /** Handle info of response to proxy */
  handleRes2ProxyInfo?: (info: ResponseInfo) => ResponseInfo | void;

  /** Info of proxy server */
  proxyServerInfo?: {
    origin: string;
    url2ProxyStatus?: string;
  };
  isPrintLog?: boolean;
}

export interface ProxyStatus {
  id: string;
  request?: {origin: RequestInfo; proxy: ProxyRequestInfo};
  response?: {
    toProxy: ResponseInfo;
    toOrigin: ResponseInfo;
  };
  err?: {
    message: Error['message'];
    stack: Error['stack']
  }
}
