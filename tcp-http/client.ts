import {Readable, Transform, isReadable} from 'stream';
import {CanConvertToBuffer, HttpResponseInfo, HttpRequestOptions} from '../types';
import {toBuffer} from '../transform';
import {Socket, TcpNetConnectOpts} from 'net';
import {getDataFromReadable} from '../stream';
import {httpOptionsToTcpConfig, tcpRequestPropsToBuffer} from './service';
import {startSocketClient} from '../net';

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

export function tcpResponsePropsToBuffer(info: HttpResponseInfo): Buffer {
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
