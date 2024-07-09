import http from 'http';
import {getDataFromReadable} from '../stream';
import {fromBuffer, toBuffer} from '../transform';
import {CanConvertToBuffer, HttpHeaderPartProps, HttpResponseProps, TcpHttpRequestProps} from '../types';
import {isPlainObject} from '../external';
import {Readable} from 'stream';

export function getRequestHeaderInfo(request: http.IncomingMessage): HttpHeaderPartProps<'Server'> {
  const {method, url, httpVersion, headers} = request;
  return {method, url, httpVersion, headers};
}
export async function getRequestInfo(request: http.IncomingMessage): Promise<TcpHttpRequestProps> {
  const data = fromBuffer(await getDataFromReadable(request), 'json');
  return {
    ...getRequestHeaderInfo(request),
    data,
  };
}

export function getResponseHeaderInfo(response: http.IncomingMessage): HttpResponseProps {
  const {httpVersion, statusCode, statusMessage, headers} = response;
  return {statusCode, statusMessage, httpVersion, headers};
}
export async function getResponseInfo<T>(
  response: http.IncomingMessage,
  options: {
    maxLength?: number;
    dataType?: 'buffer' | 'string' | 'json';
  } = {}
): Promise<HttpResponseProps<T>> {
  const {maxLength = 32 * 1024 * 1024, dataType = 'json'} = options;
  const data = await getDataFromReadable(response);
  const slicedData = data.subarray(0, maxLength);
  const finalData = fromBuffer(slicedData, dataType);
  const responseInfo = {
    ...getResponseHeaderInfo(response),
    data: finalData as T,
  };
  return responseInfo;
}

export function getMimeTypeByData(data: CanConvertToBuffer | Readable) {
  if (isPlainObject(data)) {
    return 'application/json';
  } else {
    return 'application/text';
  }
}

export function responseInfoToBuffer(responseInfo: Partial<HttpResponseProps>) {
  const {httpVersion = 'HTTP/1.1', statusCode = 200, statusMessage = 'OK', headers = {}, data} = responseInfo;
  const firstLine = [httpVersion, statusCode, statusMessage].join(' ').toUpperCase();
  const bufferOfData = toBuffer(data);
  headers['content-type'] = getMimeTypeByData(data);
  if (bufferOfData.byteLength > 0) {
    headers['content-length'] = bufferOfData.byteLength + '';
  } else {
    headers['content-length'] = 0 + '';
  }
  const headerLines = Object.entries(headers).map(([key, value]) => {
    return key + ': ' + value;
  });
  const headerPart = [firstLine, ...headerLines].join('\r\n') + '\r\n\r\n';
  return toBuffer([headerPart, data]);
}
