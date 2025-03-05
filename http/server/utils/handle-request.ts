import http from 'http';
import {convertToBuffer} from '../../../transform';
import {getHttpRequestInfo, customResponseByConfig} from '../service';
import {CustomResponseOptions} from '../../../types';
import {toNormalizedUrlProps, isPlainObject, unifyNull} from '../../../external';

/**
 * Frequently used way of handle request
 */

/**
 * response/echo requestInfo
 */
export async function responseHttpRequestInfo(request: http.IncomingMessage, response: http.ServerResponse) {
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
  request: http.IncomingMessage,
  response: http.ServerResponse,
  config?: CustomResponseOptions
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

export function response404(request: http.IncomingMessage, response: http.ServerResponse) {
  response.statusCode = 404;
  response.statusMessage = 'Not Found';
  response.setHeader('content-type', 'text/plain');
  response.end('NOT Found');
}
