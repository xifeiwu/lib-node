import {Readable, Transform, isReadable} from 'stream';
import {CanConvertToBuffer, TcpHttpRequestProps, HttpResponseProps, HttpFirstLineProps} from '../../types';
import {httpFirstLineReg, httpHeaderLineReg} from '../../constants';
import {TcpNetConnectOpts} from 'net';


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
  firstLineInfo?: HttpFirstLineProps;
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