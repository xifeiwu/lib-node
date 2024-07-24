import {Readable, Transform, isReadable} from 'stream';
import {
  CanConvertToBuffer,
  TcpHttpRequestProps,
  HttpResponseProps,
  HttpRequestOptions,
  TcpRequestProps,
} from '../../types';
import {toBuffer} from '../../transform';
import {getUrlPropsFromConfig, toUrlInstance, urlPropsToHref, concatOriginWithPathname} from '../../external';
import {startSocketClient} from '../utils';
import {Socket, TcpNetConnectOpts} from 'net';
import {getDataFromReadable} from '../../stream';
import {normalizeUrlProps} from '../../../fe/url';

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
    client.write(tcpRequestPropsToBuffer({method, url, headers, data}));
    (data as Readable)
      .pipe(
        new Transform({
          transform(chunk, enc, cb) {
            const buffer = toBuffer(chunk);
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
    client.end(tcpRequestPropsToBuffer({method, url, headers, data}));
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

export function tcpResponsePropsToBuffer(info: HttpResponseProps): Buffer {
  let {httpVersion, statusCode, statusMessage, headers, data} = info;
  let bufferArray: CanConvertToBuffer[] = [];
  if (!/^http\//i.test(httpVersion)) {
    httpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine =
    [httpVersion, statusCode, statusMessage].map(it => String(it).toUpperCase()).join(' ') + '\r\n';
  if (data) {
    const dataBuffer = toBuffer(data);
    headers['content-length'] = dataBuffer.byteLength + '';
    headers['connection'] = 'close';
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
