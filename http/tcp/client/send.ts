import {Socket, TcpNetConnectOpts} from 'net';
import {Readable, Transform, isReadable} from 'stream';
import {convertToBuffer, httpRequestInfoToBuffer, httpRequestOptionsToHttpInfo} from '../../../index';
import {getDataFromReadable} from '../../../stream';
import {startSocketClient, startTlsClient} from '../../../net';
import {CanConvertToBuffer, HttpRequestOptions, HttpRequestInfo} from '../../../types';
import {TLSSocket} from 'tls';
import {OutgoingHttpHeaders} from 'http';

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
    info: {method, url, httpVersion, headers, data},
    target,
    urlInst,
  } = httpRequestOptionsToHttpInfo(httpOption);
  let client: Socket | TLSSocket;
  if (tcpOptions instanceof Socket) {
    client = tcpOptions;
  } else {
    const mergedOptions = {
      ...tcpOptions,
      ...target,
    };
    if (urlInst.protocol === 'https:') {
      client = await startTlsClient(mergedOptions);
    } else {
      client = await startSocketClient(mergedOptions);
    }
  }

  const dataIsStream = isReadable(data as Readable);
  const supplementHeaders: OutgoingHttpHeaders = {
    host: urlInst.host,
  };
  let bufferData = Buffer.alloc(0);
  if (dataIsStream) {
    supplementHeaders['transfer-encoding'] = 'chunked';
  } else {
    if (data !== undefined) {
      bufferData = convertToBuffer(data);
    }
    supplementHeaders['content-length'] = bufferData.byteLength;
  }
  const headerPart = httpRequestInfoToBuffer(
    {
      method,
      url,
      httpVersion,
      headers,
    },
    {
      role: 'sender',
      supplementHeaders,
    }
  );
  if (dataIsStream) {
    client.write(headerPart);
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
    if (bufferData.byteLength > 0) {
      client.write(headerPart);
      client.write(bufferData);
    } else {
      client.write(headerPart);
    }
  }
  return client;
}

export async function requestAndGetResponseOnTcp(
  httpOption: HttpRequestOptions,
  tcpOptions?: TcpNetConnectOpts
) {
  const client = await sendHttpRequestByTcp(httpOption, tcpOptions);
  const data = await getDataFromReadable(client);
  return data;
}
