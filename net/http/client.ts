import {Readable, Transform, isReadable} from 'stream';
import {CanConvertToBuffer, TcpHttpRequestProps, HttpResponseProps} from '../types';
import {toBuffer} from '../transform';
import {HttpRequestOptions} from '.';
import {getUrlPropsFromConfig, toUrlInstance, urlPropsToHref, concatOriginWithPathname} from '../external';
import {startSocketClient} from './utils';
import {TcpNetConnectOpts} from 'net';

export function httpOptionsToTcpConfig(httpOption: HttpRequestOptions): {
  props: TcpHttpRequestProps;
  connectionOptions: TcpNetConnectOpts;
} {
  const {
    urlProps,
    restProps: {method, headers, data},
  } = getUrlPropsFromConfig(httpOption);
  const {origin, ...otherUrlProps} = urlProps;
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

type TcpRequestProps = Omit<TcpHttpRequestProps, 'method' | 'url' | 'httpVersion' | 'headers'> &
  Partial<Pick<TcpHttpRequestProps, 'method' | 'url' | 'httpVersion' | 'headers'>>;
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
    headers['content-length'] = dataBuffer.byteLength + '';
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

export async function sendHttpRequestThroughTcp(
  httpOption: HttpRequestOptions,
  tcpOptions?: TcpNetConnectOpts
) {
  const {
    props: {method, url, headers, data},
    connectionOptions,
  } = httpOptionsToTcpConfig(httpOption);
  const client = await startSocketClient({
    ...tcpOptions,
    ...connectionOptions,
  });
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
  return new Promise<string>((res, rej) => {
    const bufList: Buffer[] = [];
    client.on('error', err => {
      rej(err);
    });
    client.on('data', chunk => {
      bufList.push(chunk);
    });
    client.on('end', chunk => {
      const data = toBuffer(bufList);
      res(data.toString());
    });
  });
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
