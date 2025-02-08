import http from 'http';
import {CustomResponseOptions, HttpRequestOptions} from '../../../types';
import {convertToBuffer} from '../../../transform';
import {
  deepEqual,
  toNormalizedUrlProps,
  isNumber,
  waitFor,
  toInteger,
  isString,
  isObject,
  isPlainObject,
} from '../../../external';
import {getHttpRequestHeaderPartInfo, getHttpRequestInfo} from './utils';

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

function setHeader(response: http.ServerResponse, key: string, value: string | number) {
  response.setHeader(key, value);
}
export async function customResponse(response: http.ServerResponse, config?: CustomResponseOptions) {
  const {delayMs, statusCode, statusMessage, headers, data} = config ?? {};
  if (delayMs) {
    const delayInMs = parseInt(delayMs as string);
    !Number.isNaN(delayInMs) && (await waitFor(delayInMs));
  }
  if (statusCode) {
    const code = toInteger(statusCode);
    if (isNumber(code)) {
      response.statusCode = code;
    }
  }
  if (isString(statusMessage)) {
    response.statusMessage = statusMessage;
  }
  if (isObject(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (Array.isArray(value)) {
        value.forEach(it => setHeader(response, key, it));
      } else {
        setHeader(response, key, value);
      }
    }
  }
  let sentData = false;
  if (data) {
    response.setHeader('content-type', 'application/json');
    response.end(convertToBuffer(data));
    sentData = true;
  }
  return {sentData, config};
}

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
  return customResponse(response, finalConfig);
}

export interface HttpConditionAndAction {
  requestConfig: Pick<HttpRequestOptions, 'method' | 'pathname' | 'query'>;
  action: CustomResponseOptions;
}
/**
 * TODO: rename to customHandleIncomingMessages
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
  await customResponse(response, matchedConfig.action);
  return false;
}
