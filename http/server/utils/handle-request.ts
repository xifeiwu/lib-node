import http from 'http';
import {convertToBuffer} from '../../../transform';
import {getHttpRequestInfo, customResponseByConfig} from '../service';
import {CustomizeResponseOptions} from '../../../types';
import {toNormalizedUrlProps, isPlainObject, unifyNull} from '../../../external';

/**
 * Frequently used way of handle request
 */

/**
 * response/echo requestInfo
 */
export async function responseHttpRequestInfo(response: http.ServerResponse, request: http.IncomingMessage) {
  const requestInfo = await getHttpRequestInfo(request);
  const resData = convertToBuffer(requestInfo);
  response.setHeader('content-length', resData.byteLength);
  response.setHeader('content-type', 'application/json');
  response.end(resData);
}

/**
 * return data or config
 */
export async function customResponseByRequest(
  response: http.ServerResponse,
  request: http.IncomingMessage,
  config?: CustomizeResponseOptions
) {
  const {url, data} = await getHttpRequestInfo(request);
  const {query} = toNormalizedUrlProps(url);
  const finalConfig = {
    ...(isPlainObject(query) ? query : {}),
    ...(isPlainObject(data) ? data : {}),
    ...(config ?? {}),
  };
  const {sentData} = await customResponseByConfig(response, finalConfig);
  if (!sentData) {
    let chunk: Buffer = Buffer.alloc(0);
    if (unifyNull(finalConfig) !== null) {
      chunk = convertToBuffer(finalConfig);
    }
    response.end(chunk);
  }
  return finalConfig;
}

export function stopServer(response: http.ServerResponse) {
  response.statusCode = 302;
  response.setHeader('Location', '/');
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(convertToBuffer(`Redirecting to <a href="/">index</a>.`));
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}
