import {Readable, Transform, isReadable} from 'stream';
import {CanConvertToBuffer, TcpHttpRequestProps, HttpResponseProps} from '../types';
import {toBuffer} from '../transform';
import {httpFirstLineReg, httpHeaderLineReg} from '../constants';
import {HttpRequestOptions} from '../http';
import {getUrlPropsFromConfig, toUrlInstance, urlPropsToHref} from '../external';
import {startSocketClient} from './utils';
import {TcpNetConnectOpts} from 'net';
import {concatOriginWithPathname} from '../../fe/url';

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

type TcpRequestProps = Omit<TcpHttpRequestProps, 'method' | 'headers' | 'httpVersion'> &
  Partial<Pick<TcpHttpRequestProps, 'method' | 'headers' | 'httpVersion'>>;
export function tcpRequestPropsToBuffer(info: TcpRequestProps): Buffer {
  let {method = 'get', url, httpVersion = 'HTTP/1.1', headers = {}, data} = info;
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

export function tcpResponsePropsToBuffer(info: TcpHttpResponseProps): Buffer {
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

export function getMatcher4LineBreak() {
  const valueR = 0x0d;
  const valueN = 0x0a;
  const status = {
    matchR: false,
    matchN: false,
  };
  return (n: number) => {
    if (!status.matchR) {
      if (n === valueR) {
        status.matchR = true;
      }
    } else {
      if (n === valueN) {
        return true;
      } else {
        status.matchR = false;
      }
    }
    return false;
  };
}

interface ParseFirstLineResults {
  firstLineInfo?: TcpHttpFirstLineProps;
  dataConsumed: Buffer;
}
export async function parseHttpFirstLine(reader: Readable): Promise<ParseFirstLineResults> {
  let method: TcpHttpRequestProps['method'];
  let url: TcpHttpRequestProps['url'];
  let httpVersion: TcpHttpRequestProps['httpVersion'];
  const maxLength = 1024;
  let matcher = getMatcher4LineBreak();
  let resolve: (v: ParseFirstLineResults) => void;
  let reject: (err: Error) => void;

  const onReadable = () => {
    let cacheBuffer = Buffer.alloc(0);
    try {
      while (reader.readableLength > 0) {
        const oneByte = reader.read(1);
        if (oneByte === null) {
          break;
        }
        cacheBuffer = Buffer.concat([cacheBuffer, oneByte]);
        if (matcher(oneByte[0])) {
          const line = cacheBuffer.toString('utf-8').trim().replace(/\r\n$/, '');
          const execResult = httpFirstLineReg.exec(line);
          if (execResult) {
            [method, url, httpVersion] = execResult.slice(1);
          }
          break;
        } else if (cacheBuffer.byteLength > maxLength) {
          break;
        }
      }
      resolve({
        firstLineInfo: method !== undefined ? {method, url, httpVersion} : undefined,
        dataConsumed: cacheBuffer,
      });
    } catch (err) {
      reject(err);
    }
  };
  reader.once('readable', onReadable);
  return new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
}
interface ParseHttpHeaderResults<T extends Readable> {
  requestInfo: TcpHttpRequestProps;
  reader: T;
  dataConsumed: Buffer;
}
export async function parseHttpHeaderPart<T extends Readable>(
  reader: T,
  initialValue?: Partial<TcpHttpRequestProps>
): Promise<ParseHttpHeaderResults<T>> {
  let requestInfo: TcpHttpRequestProps;
  let resolve: (v: ParseHttpHeaderResults<T>) => void;
  let reject: (err: Error) => void;
  let {method, url, httpVersion, headers = {}} = initialValue ?? {};
  let dataConsumed = Buffer.alloc(0);

  /**
   * Update http header value
   * @param chunk one line
   * @returns continue or not
   */
  const updateValue = (chunk: Buffer) => {
    const line = chunk.toString('utf-8').trim().replace(/\r\n$/, '');
    let execResult: RegExpExecArray;
    if (method === undefined) {
      execResult = httpFirstLineReg.exec(line);
      if (execResult) {
        [method, url, httpVersion] = execResult.slice(1);
        return true;
      } else {
        return false;
      }
    } else if ((execResult = httpHeaderLineReg.exec(line))) {
      const [field, value] = execResult.slice(1);
      if (!Object.prototype.hasOwnProperty.call(headers, field)) {
        headers[field] = value;
      } else {
        if (!Array.isArray(headers[field])) {
          headers[field] = [headers[field] as string];
        }
        (headers[field] as string[]).push(value);
      }
      return true;
    } else if (line === '') {
      requestInfo = {
        method,
        url,
        httpVersion,
        headers,
      };
      /** Meets end of header part, will not continue parse logic */
      return false;
    }
    return false;
  };

  const onReadable = () => {
    let cacheBuffer = Buffer.alloc(0);
    let matcher = getMatcher4LineBreak();
    try {
      while (reader.readableLength > 0) {
        const oneByte = reader.read(1);
        if (oneByte === null) {
          break;
        }
        cacheBuffer = Buffer.concat([cacheBuffer, oneByte]);
        dataConsumed = Buffer.concat([dataConsumed, oneByte]);
        if (matcher(oneByte[0])) {
          if (!updateValue(cacheBuffer)) {
            break;
          }
          cacheBuffer = Buffer.alloc(0);
          matcher = getMatcher4LineBreak();
        }
      }
      resolve({
        requestInfo,
        reader,
        dataConsumed,
      });
    } catch (err) {
      reject(err);
    }
  };
  reader.once('readable', onReadable);
  return new Promise<ParseHttpHeaderResults<T>>((res, rej) => {
    resolve = res;
    reject = rej;
  });
}
