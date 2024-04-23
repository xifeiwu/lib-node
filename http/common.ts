import http, {IncomingHttpHeaders} from 'http';
import {getStreamData} from '../stream';
import {fromBuffer} from '../transform';
import {ResponseInfo} from '../types';

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
  const {maxLength = 32 * 1024 * 1024, dataType = 'json'} = options;
  const data = await getStreamData(response);
  const slicedData = data.subarray(0, maxLength);
  const finalData = fromBuffer(slicedData, dataType);
  const responseInfo = {
    ...getResponseHeaderInfo(response),
    data: finalData as T,
  };
  return responseInfo;
}
