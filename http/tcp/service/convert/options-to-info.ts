import {TcpNetConnectOpts} from 'net';
import {toUrlInstance, getUrlPropsFromConfig, urlPropsToHref, urlInstanceToProps} from '../../../../external';
import {HttpRequestOptions, HttpRequestInfo, ConnectionRole, HttpRequestInfoFull} from '../../../../types';
import {httpRequestInfoToBuffer} from './info-to-buffer';
/**
 * Convert HttpRequestOptions to
 * @param httpOption
 * @returns
 */
export function httpRequestOptionsToHttpInfo(httpOption: HttpRequestOptions): HttpRequestInfoFull {
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
  const overTls = protocol === 'https:';
  if (!finalPort) {
    finalPort = overTls ? 443 : 80;
  }
  return {
    info: {method, url: urlStr, headers, data, httpVersion: 'HTTP/1.1'},
    target: {
      host: hostname,
      port: Number(finalPort),
      overTls,
    },
    urlInst,
  };
}

export function httpRequestOptionsToBuffer(
  requestOptions: HttpRequestOptions,
  options?: {
    /**
     * if role is sender, will adapt header part by existing info
     */
    role?: ConnectionRole;
  }
) {
  const {info, ...rest} = httpRequestOptionsToHttpInfo(requestOptions);
  const buffer = httpRequestInfoToBuffer(info, options);
  return {
    buffer,
    ...rest,
  };
}
