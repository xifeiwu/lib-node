import http, {IncomingHttpHeaders} from 'http';
import {getStreamData} from '../stream';
import {fromBuffer} from '../transform';

// GET /api/test/echo HTTP/1.1
export interface RequestInfo<T = any> {
  method: string;
  url: string;
  httpVersion: string;
  headers: IncomingHttpHeaders;
  data: T;
}
export function getRequestHeaderInfo(request: http.IncomingMessage) {
  const {method, url, httpVersion, headers} = request;
  return {method, url, httpVersion, headers};
}
export async function getRequestInfo(request: http.IncomingMessage) {
  const data = fromBuffer(await getStreamData(request), 'json');
  return {
    ...getRequestHeaderInfo(request),
    data,
  };
}

// HTTP/1.1 200 OK
export interface ResponseInfo<T = any> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
  data?: T;
}
export function getResponseHeaderInfo(response: http.IncomingMessage): ResponseInfo {
  const {httpVersion, statusCode, statusMessage, headers} = response;
  return {statusCode, statusMessage, httpVersion, headers};
}
export async function getResponseInfo<T>(
  response: http.IncomingMessage,
  options: {
    maxLength?: number;
    dataType?: 'buffer' | 'string' | 'json';
  } = {}
): Promise<ResponseInfo<T>> {
  const {maxLength = 32 * 1024, dataType = 'json'} = options;
  const data = await getStreamData(response);
  const slicedData = data.subarray(0, maxLength);
  const finalData = fromBuffer(slicedData, dataType);
  return {
    ...getResponseHeaderInfo(response),
    data: finalData as T,
  };
}
