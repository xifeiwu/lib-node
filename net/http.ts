import {Readable} from 'stream';
import {CanConvertToBuffer, toBuffer} from '../transform';
import {HttpRequestInfo, HttpResponseInfo} from '../types';
import {httpFirstLineReg, httpHeaderLineReg} from '../constants';

type RequestInfo = Omit<HttpRequestInfo, 'method' | 'headers' | 'httpVersion'> &
  Partial<Pick<HttpRequestInfo, 'method' | 'headers' | 'httpVersion'>>;
export function getRequestData(info: RequestInfo): Buffer {
  let {method = 'get', url, httpVersion = 'HTTP/1.1', headers = {}, data} = info;
  let bufferArray: CanConvertToBuffer[] = [];
  if (!/^http\//i.test(httpVersion)) {
    httpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [method.toUpperCase(), url, httpVersion.toUpperCase()].join(' ') + '\r\n';
  if (data) {
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

export function getResponseData(info: HttpResponseInfo): Buffer {
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

interface ReturnValue<T extends Readable> {
  requestInfo: HttpRequestInfo;
  reader: T;
}
export async function parseHttpHeaderPart<T extends Readable>(reader: T): Promise<ReturnValue<T>> {
  let method: HttpRequestInfo['method'];
  let url: HttpRequestInfo['url'];
  let httpVersion: HttpRequestInfo['httpVersion'];
  let headers: HttpRequestInfo['headers'] = {};
  let requestInfo: HttpRequestInfo;
  let resolve: (v: ReturnValue<T>) => void;
  let reject: (err: Error) => void;

  const getMatch = () => {
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
  };
  const updateValue = (chunk: Buffer) => {
    const line = chunk.toString('utf-8').trim().replace(/\r\n$/, '');
    if (line === '') {
      requestInfo = {
        method,
        url,
        httpVersion,
        headers,
      };
      return resolve({
        requestInfo,
        reader,
      });
    }
    if (method === undefined) {
      const execResult = httpFirstLineReg.exec(line);
      if (!execResult) {
        throw new Error(`Error format http first line: ${line}`);
      }
      [method, url, httpVersion] = execResult.slice(1);
    } else {
      const exexResult = httpHeaderLineReg.exec(line);
      if (!exexResult) {
        throw new Error(`Error format http header line: ${line}`);
      }
      const [field, value] = exexResult.slice(1);
      if (!Object.prototype.hasOwnProperty.call(headers, field)) {
        headers[field] = value;
      } else {
        if (!Array.isArray(headers[field])) {
          headers[field] = [headers[field] as string];
        }
        (headers[field] as string[]).push(value);
      }
    }
  };

  const onReadable = () => {
    let cacheBuffer = Buffer.alloc(0);
    let match = getMatch();
    try {
      while (reader.readableLength > 0) {
        const oneByte = reader.read(1);
        cacheBuffer = Buffer.concat([cacheBuffer, oneByte]);
        if (match(oneByte[0])) {
          updateValue(cacheBuffer);
          cacheBuffer = Buffer.alloc(0);
          match = getMatch();
        }
        if (requestInfo) {
          reader.off('readable', onReadable);
          break;
        }
      }
    } catch (err) {
      reject(err);
    }
  };
  reader.on('readable', onReadable);
  return new Promise<ReturnValue<T>>((res, rej) => {
    resolve = res;
    reject = rej;
  });
}
