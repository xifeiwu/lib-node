import {Readable} from 'stream';
import {CanConvertToBuffer, toBuffer} from '../transform';
import {HttpFirstLineInfo, HttpRequestInfo, HttpResponseInfo} from '../types';
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
  firstLineInfo?: HttpFirstLineInfo;
  dataConsumed: Buffer;
}
export async function parseHttpFirstLine(reader: Readable): Promise<ParseFirstLineResults> {
  let method: HttpRequestInfo['method'];
  let url: HttpRequestInfo['url'];
  let httpVersion: HttpRequestInfo['httpVersion'];
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
  requestInfo: HttpRequestInfo;
  reader: T;
  dataConsumed: Buffer;
}
export async function parseHttpHeaderPart<T extends Readable>(
  reader: T,
  initialValue?: Partial<HttpRequestInfo>
): Promise<ParseHttpHeaderResults<T>> {
  let requestInfo: HttpRequestInfo;
  let resolve: (v: ParseHttpHeaderResults<T>) => void;
  let reject: (err: Error) => void;
  let {method, url, httpVersion, headers = {}} = initialValue ?? {};
  let dataConsumed = Buffer.alloc(0);

  const updateValue = (chunk: Buffer) => {
    const line = chunk.toString('utf-8').trim().replace(/\r\n$/, '');
    if (line === '') {
      requestInfo = {
        method,
        url,
        httpVersion,
        headers,
      };
      return;
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
    let matcher = getMatcher4LineBreak();
    try {
      while (reader.readableLength > 0) {
        const oneByte = reader.read(1);
        if (oneByte === null) {
          break;
        }
        cacheBuffer = Buffer.concat([cacheBuffer, oneByte]);
        if (matcher(oneByte[0])) {
          updateValue(cacheBuffer);
          dataConsumed = Buffer.concat([dataConsumed, cacheBuffer]);
          cacheBuffer = Buffer.alloc(0);
          matcher = getMatcher4LineBreak();
        }
        if (requestInfo) {
          break;
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
