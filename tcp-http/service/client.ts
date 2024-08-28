import {Readable, isReadable} from 'stream';
import {CanConvertToBuffer, TcpHttpRequestProps, HttpRequestOptions, TcpRequestProps} from '../../types';
import {toBuffer} from '../../transform';
import {
  getUrlPropsFromConfig,
  toUrlInstance,
  urlPropsToHref,
  concatOriginWithPathname,
  normalizeUrlProps,
} from '../../external';
import {Socket, TcpNetConnectOpts} from 'net';

/**
 * Convert HttpRequestOptions to
 * @param httpOption
 * @returns
 */
export function httpOptionsToTcpConfig(httpOption: HttpRequestOptions): {
  props: TcpHttpRequestProps;
  connectionOptions: Pick<TcpNetConnectOpts, 'host' | 'port'>;
} {
  const {
    urlProps,
    restProps: {method, headers, data},
  } = getUrlPropsFromConfig(httpOption);
  /** normalize url: otherUrlProps contains tcp url part  */
  const {origin, ...otherUrlProps} = normalizeUrlProps(urlProps);
  /** As otherUrlProps not contain origin, url should only contain pathname + query + hash */
  const url = urlPropsToHref(otherUrlProps);
  const {protocol, hostname, port} = toUrlInstance(concatOriginWithPathname(origin, url));
  let finalPort: string | number = port;
  if (!finalPort) {
    finalPort = protocol === 'https:' ? 443 : 80;
  }
  return {
    props: {method, url, headers, data, httpVersion: 'HTTP/1.1'},
    connectionOptions: {
      host: hostname,
      port: Number(finalPort),
    },
  };
}

export function tcpRequestPropsToBuffer(info: TcpRequestProps): Buffer {
  let {method = 'get', url = '/', httpVersion = 'HTTP/1.1', headers = {}, data} = info;
  let bufferArray: CanConvertToBuffer[] = [];
  if (!/^http\//i.test(httpVersion)) {
    httpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [method.toUpperCase(), url, httpVersion.toUpperCase()].join(' ') + '\r\n';
  if (isReadable(data as Readable)) {
    headers['Transfer-Encoding'] = 'chunked';
  } else {
    const dataBuffer = toBuffer(data);
    const headerKeys = Object.keys(headers).map(it => it.toLowerCase());
    /** Do not set content-length if it already exist in headers, or it will cause error */
    if (!headerKeys.includes('content-length')) {
      headers['content-length'] = dataBuffer.byteLength + '';
    }
    // headers['connection'] = 'close';
    bufferArray.push(dataBuffer);
  }
  const headersLine = Object.entries(headers)
    .map(([key, value]) => {
      return `${key}: ${value}` + '\r\n';
    })
    .join('');
  const headerStr = firstLine + headersLine + '\r\n';
  bufferArray.unshift(headerStr);
  return toBuffer(bufferArray);
}
