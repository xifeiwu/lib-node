import http from 'http';
import {CustomHandleRequestOptions, HttpRequestOptions} from '../../../types';
import {deepEqual, toNormalizedUrlProps, isNumber, waitFor, toInteger} from '../../../external';
import {getHttpRequestHeaderPartInfo} from './utils';

export interface HttpConditionAndAction {
  requestConfig: Pick<HttpRequestOptions, 'method' | 'pathname' | 'query'>;
  action: CustomHandleRequestOptions;
}

/**
 * Do some actions by HttpConditionAndAction
 * @returns Whether the request is handled by this function or not
 */
export async function handleIncomingMessage(
  httpStream: {request: http.IncomingMessage; response?: http.ServerResponse},
  configList?: HttpConditionAndAction[]
) {
  const {request, response} = httpStream;
  const {method, url} = getHttpRequestHeaderPartInfo(request);
  const {pathname, query} = toNormalizedUrlProps(url);
  if (!Array.isArray(configList)) {
    return false;
  }
  const matchedConfig = configList.find(config => {
    const {requestConfig} = config;
    if (requestConfig.method.toLowerCase() !== method.toLowerCase() || requestConfig.pathname !== pathname) {
      return false;
    }
    if (requestConfig.query) {
      return deepEqual(requestConfig.query, query);
    }
    return true;
  });
  if (!matchedConfig) {
    return false;
  }
  await customHandleRequest(httpStream, matchedConfig.action);
  return false;
}

export async function customHandleRequest(
  httpStream: {request: http.IncomingMessage; response?: http.ServerResponse},
  config?: CustomHandleRequestOptions
) {
  const {response} = httpStream;
  const {delayMs, responseCode} = config ?? {};
  if (delayMs) {
    const delayInMs = parseInt(delayMs as string);
    !Number.isNaN(delayInMs) && (await waitFor(delayInMs));
  }
  if (responseCode) {
    const code = toInteger(responseCode);
    if (isNumber(code)) {
      response.statusCode = code;
    }
  }
  return;
}
