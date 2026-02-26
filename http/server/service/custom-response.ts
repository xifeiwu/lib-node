import http from 'http';
import {CustomizeResponseOptions, HttpRequestOptions} from '../../../types';
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
  unifyNull,
} from '../../../external';
import {getHttpRequestHeaderPartInfo, getHttpRequestInfo} from './receive';

function setHeader(response: http.ServerResponse, key: string, value: string | number) {
  response.setHeader(key, value);
}

export async function customResponseByConfig(
  response: http.ServerResponse,
  config?: CustomizeResponseOptions
) {
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
    if (response.getHeader('content-type') === undefined) {
      response.setHeader('content-type', 'application/json');
    }
    response.end(convertToBuffer(data));
    sentData = true;
  }
  return response;
}

/**
 * return final config, if the data is not set in request body
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
  await customResponseByConfig(response, finalConfig);
  if (!response.writableEnded) {
    let chunk: Buffer = Buffer.alloc(0);
    if (unifyNull(finalConfig) !== null) {
      chunk = convertToBuffer(finalConfig);
    }
    response.end(chunk);
  }
  return finalConfig;
}

export interface HttpConditionAndAction {
  ignore?: boolean;
  key?: string;
  requestOptions: Pick<HttpRequestOptions, 'method' | 'pathname' | 'query'>;
  action: CustomizeResponseOptions;
}

export async function handleIncomingMessageByConfig(
  httpStream: {request: http.IncomingMessage; response: http.ServerResponse},
  configList?: HttpConditionAndAction[]
) {
  const {request, response} = httpStream;
  const {method, url} = getHttpRequestHeaderPartInfo(request);
  const {pathname, query} = toNormalizedUrlProps(url);
  const curRequestOptions = {
    method,
    pathname,
    query,
  };
  if (!Array.isArray(configList)) {
    return response;
  }
  const matchedConfig = configList.find(config => {
    const {ignore, requestOptions} = config;
    if (ignore || !requestOptions) {
      return false;
    }
    const keys: Array<keyof HttpRequestOptions> = ['method', 'pathname', 'query'];
    const isSame = keys.every(key => {
      const value = requestOptions[key];
      if (value === undefined) {
        return true;
      }
      if (isObject(value)) {
        return deepEqual(value, curRequestOptions[key]);
      } else {
        return value === curRequestOptions[key];
      }
    });
    return isSame;
  });
  if (!matchedConfig) {
    return response;
  }
  response.setHeader('z-customize-response', matchedConfig.key ?? JSON.stringify(matchedConfig));
  await customResponseByConfig(response, matchedConfig.action);
  return response;
}

/**
 * @deprecated
 * TODO: rename to handleIncomingMessageByConfig, their logic is similar
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
    const {requestOptions} = config;
    if (
      requestOptions.method.toLowerCase() !== method.toLowerCase() ||
      requestOptions.pathname !== pathname
    ) {
      return false;
    }
    if (requestOptions.query) {
      return deepEqual(requestOptions.query, query);
    }
    return true;
  });
  if (!matchedConfig) {
    return false;
  }
  await customResponseByConfig(response, matchedConfig.action);
  return false;
}
