import {Socket, TcpNetConnectOpts} from 'net';
import {Readable, Transform, isReadable} from 'stream';
import {convertToBuffer, getDataFromReadable, startSocketClient} from '../../index';
import {CanConvertToBuffer, HttpRequestOptions, HttpRequestInfo} from '../../types';
import {
  getUrlPropsFromConfig,
  toUrlInstance,
  urlPropsToHref,
  concatOriginWithPathname,
  normalizeUrlProps,
} from '../../external';

/**
 * Convert HttpRequestOptions to
 * @param httpOption
 * @returns
 */
export function httpOptionsToTcpConfig(httpOption: HttpRequestOptions): {
  props: HttpRequestInfo;
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

/**
 * @deprecated by httpRequestInfoToBuffer
 * @param info 
 * @returns 
 */
export function tcpRequestPropsToBuffer(info: HttpRequestInfo): Buffer {
  let {method = 'get', url = '/', httpVersion = 'HTTP/1.1', headers = {}, data} = info;
  let bufferArray: CanConvertToBuffer[] = [];
  if (!/^http\//i.test(httpVersion)) {
    httpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [method.toUpperCase(), url, httpVersion.toUpperCase()].join(' ') + '\r\n';
  if (isReadable(data as Readable)) {
    headers['Transfer-Encoding'] = 'chunked';
  } else {
    const dataBuffer = convertToBuffer(data);
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
  return convertToBuffer(bufferArray);
}

export async function sendHttpRequestByTcp(
  httpOption: HttpRequestOptions,
  tcpOptions?: Partial<TcpNetConnectOpts> | Socket
) {
  const {
    props: {method, url, headers, data},
    connectionOptions,
  } = httpOptionsToTcpConfig(httpOption);
  let client: Socket;
  if (tcpOptions instanceof Socket) {
    client = tcpOptions;
  } else {
    client = await startSocketClient({
      ...tcpOptions,
      ...connectionOptions,
    });
  }
  if (isReadable(data as Readable)) {
    client.write(tcpRequestPropsToBuffer({method, url, headers, data, httpVersion: '1.1'}));
    (data as Readable)
      .pipe(
        new Transform({
          transform(chunk, enc, cb) {
            const buffer = convertToBuffer(chunk);
            const {byteLength} = buffer;
            const hexStr = byteLength.toString(16);
            this.push(hexStr + '\r\n');
            this.push(buffer);
            this.push('\r\n');
            cb && cb();
          },
          final(cb) {
            const byteLength = 0;
            const hexStr = byteLength.toString(16);
            this.push(hexStr + '\r\n');
            this.push('\r\n');
            cb && cb();
          },
        })
      )
      .pipe(client);
  } else {
    client.end(tcpRequestPropsToBuffer({method, url, headers, data, httpVersion: '1.1'}));
  }
  return client;
}

export async function sendHttpRequestByTcpAndGetResponseData(
  httpOption: HttpRequestOptions,
  tcpOptions?: TcpNetConnectOpts
) {
  const client = await sendHttpRequestByTcp(httpOption, tcpOptions);
  const data = await getDataFromReadable(client);
  return data;
}
