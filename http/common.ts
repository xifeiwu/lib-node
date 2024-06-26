import http from 'http';
import {getStreamData} from '../stream';
import {fromBuffer, toBuffer} from '../transform';
import {TcpHttpHeaderPartProps, TcpHttpRequestProps, TcpHttpResponseProps} from '../types';

export function getRequestHeaderInfo(request: http.IncomingMessage): TcpHttpHeaderPartProps {
  const {method, url, httpVersion, headers} = request;
  return {method, url, httpVersion, headers};
}
export async function getRequestInfo(request: http.IncomingMessage): Promise<TcpHttpRequestProps> {
  const data = fromBuffer(await getStreamData(request), 'json');
  return {
    ...getRequestHeaderInfo(request),
    data,
  };
}

export function getResponseHeaderInfo(response: http.IncomingMessage): TcpHttpResponseProps {
  const {httpVersion, statusCode, statusMessage, headers} = response;
  return {statusCode, statusMessage, httpVersion, headers};
}
export async function getResponseInfo<T>(
  response: http.IncomingMessage,
  options: {
    maxLength?: number;
    dataType?: 'buffer' | 'string' | 'json';
  } = {}
): Promise<TcpHttpResponseProps<T>> {
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

export function responseInfoToBuffer(responseInfo: Partial<TcpHttpResponseProps>) {
  const {
    httpVersion = 'http/1.1',
    statusCode = 200,
    statusMessage = 'success',
    headers = {},
    data,
  } = responseInfo;
  const firstLine = [httpVersion, statusCode, statusMessage].join(' ').toUpperCase();
  const headerLines = Object.entries(headers).map(([key, value]) => {
    return key + ': ' + value;
  });
  const headerPart = [firstLine, ...headerLines].join('\r\n') + '\r\n\r\n';
  return toBuffer([headerPart, data]);
}
