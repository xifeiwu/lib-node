import {TcpNetConnectOpts} from 'net';
import {toUrlInstance, getUrlPropsFromConfig, urlPropsToHref, urlInstanceToProps} from '../../../external';
import {HttpRequestOptions, HttpRequestInfo} from '../../../types';
/**
 * Convert HttpRequestOptions to
 * @param httpOption
 * @returns
 */
export function httpRequestOptionsToHttpInfo(httpOption: HttpRequestOptions): {
  info: HttpRequestInfo;
  target: Pick<TcpNetConnectOpts, 'host' | 'port'>;
  url: URL;
} {
  const {
    urlProps,
    restProps: {method = 'get', headers, data, port},
  } = getUrlPropsFromConfig(httpOption);
  const urlInst = toUrlInstance(urlProps);
  const {hostname, protocol} = urlInst;
  const {origin, ...otherUrlProps} = urlInstanceToProps(urlInst);
  /** As otherUrlProps not contain origin, url should only contain pathname + query + hash */
  const urlStr = urlPropsToHref(otherUrlProps);
  let finalPort = port ?? urlInst.port;
  if (!finalPort) {
    finalPort = protocol === 'https:' ? 443 : 80;
  }
  return {
    info: {method, url: urlStr, headers, data, httpVersion: 'HTTP/1.1'},
    target: {
      host: hostname,
      port: Number(finalPort),
    },
    url: urlInst,
  };
}
