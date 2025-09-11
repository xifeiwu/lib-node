import http from 'http';
import https from 'https';
import {convertToBuffer} from '../../transform';
import {Socket} from 'net';
import {
  toUrlInstance,
  getUrlPropsFromConfig,
  deepMerge,
  deepMergeByConcat,
  urlPropsToHref,
  isObject,
  getRandomBase64String,
  convertKeyToLowerCase,
} from '../../external';
import {
  HttpRequestOptions,
  HttpResponseInfo,
  ConnectionPayload,
  ValidateStatus,
  ParseHttpResponseOptions,
  SendHttpRequestResult,
  SendRequestWithResponseResult,
  SendRequestWithResponseInfoResult,
} from '../../types';
import {Readable} from 'stream';
import {getHttpResponseInfo} from './receiver';
import {logColorful} from '../../log';
import {updateHeadersByHttpInfo} from '../tcp';
import {mergeHttpHeaders} from '../service';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

function mergeTwoHttpRequestOptions(
  options1: HttpRequestOptions,
  options2: HttpRequestOptions
): HttpRequestOptions {
  if (options2 === undefined) {
    return options1;
  }
  const {headers: headers1 = {}, ...restOptions1} = options1;
  const {headers: headers2, ...restOptions2} = options2;
  const mergedHeaders = mergeHttpHeaders(headers1, headers2);
  return {
    ...restOptions1,
    ...restOptions2,
    headers: mergedHeaders,
  };
}
export function mergeHttpRequestOptions(
  options1: HttpRequestOptions,
  ...otherOptions: HttpRequestOptions[]
): HttpRequestOptions {
  if (otherOptions.length === 0) {
    return options1;
  } else if (otherOptions.length === 1) {
    return mergeTwoHttpRequestOptions(options1, otherOptions[0]);
  } else {
    const [options2, ...restOptions] = otherOptions;
    return mergeHttpRequestOptions(mergeHttpRequestOptions(options1, options2), ...restOptions);
  }
}

/**
 * Should set content-length if clientRequest.write(no need when call clientRequest.end)
 * Transfer-Encoding, Content-Length can set by http module automatically
 * @param options
 * @returns
 */
export function sendHttpRequest<Payload extends ConnectionPayload = any>(
  options: HttpRequestOptions<Payload>
): SendHttpRequestResult {
  const {urlProps, restProps} = getUrlPropsFromConfig(options);
  const url = toUrlInstance(urlProps);
  const {protocol, href, host} = url;
  const {data, headers = {}} = restProps;
  const {
    headers: finalHeaders,
    dataIsReadable,
    dataIsUndefined,
  } = updateHeadersByHttpInfo(
    {headers, data},
    {
      supplementHeaders: {host},
    }
  );
  const mergedRequestOptions = {...options, headers: finalHeaders};
  const request = (protocol === 'https:' ? https : http).request(href, mergedRequestOptions);
  if (dataIsUndefined) {
    request.end();
  } else {
    if (dataIsReadable) {
      /** http module will append 'transfer-encoding': 'chunked' to header part when data is stream */
      (data as Readable).pipe(request);
    } else {
      const buf = convertToBuffer(data);
      /**
       * http module will append content-length to header part when data length is fixed.
       * But when method is delete, http module will not do this work.
       */
      if (mergedRequestOptions.method.toLowerCase() === 'delete') {
        request.setHeader('content-length', buf.byteLength);
      }
      request.end(buf);
    }
  }
  return {request, url, requestOptions: mergedRequestOptions};
}

export class ResponseError extends Error {
  isResponseError: boolean = true;
  requestOptions: HttpRequestOptions;
  responseInfo: HttpResponseInfo;
  constructor(requestOptions: HttpRequestOptions, responseInfo: HttpResponseInfo) {
    const {statusCode, statusMessage} = responseInfo;
    super(`Response code ${statusCode}: ${statusMessage}`);
    this.requestOptions = requestOptions;
    this.responseInfo = responseInfo;
  }
}

export async function requestAndGetResponse<Payload extends ConnectionPayload = any>(
  options: HttpRequestOptions<Payload>
): Promise<SendRequestWithResponseResult> {
  const result = sendHttpRequest(options);
  const {request} = result;
  return new Promise((res, rej) => {
    request.on('response', async response => {
      res({response, ...result});
    });
    request.on('upgrade', async response => {
      rej(new Error(`Expect response event, but receive upgrade event.`));
    });
    request.on('timeout', () => {
      /**
       * timeout will be triggered when time-cost of request larger than timeout setted options
       * But it will not stop request process, or trigger error
       */
      // console.log('timeout');
      // clientRequest.destroy();
    });
    request.on('error', error => {
      rej(error);
    });
  });
}

export const validateStatusCode: ValidateStatus = info => {
  const {statusCode} = info;
  return statusCode >= 200 && statusCode < 300;
};

export type RequestAndGetResponseInfoFunc = typeof requestAndGetResponseInfo;
export async function requestAndGetResponseInfo<ResData = any, Payload extends ConnectionPayload = any>(
  requestOptions: HttpRequestOptions<Payload>,
  parseOptions?: ParseHttpResponseOptions
): Promise<SendRequestWithResponseInfoResult<ResData>> {
  const result = await requestAndGetResponse<Payload>(requestOptions);
  const {response, requestOptions: finalRequestOptions} = result;

  let {validateStatus, printCurlCommandOnError, bodyParserOptions} = parseOptions ?? {};
  const responseInfo = await getHttpResponseInfo<ResData>(response, bodyParserOptions);

  if (validateStatus) {
    if (validateStatus === true) {
      validateStatus = validateStatusCode;
    }

    if (!validateStatus(responseInfo)) {
      if (printCurlCommandOnError) {
        logColorful({color: 'yellow'}, httpRequestOptionsToCurlCommand(finalRequestOptions));
      }
      throw new ResponseError(requestOptions, responseInfo);
    }
  }
  return {responseInfo, ...result};
}

/**
 * @deprecated
 */
export type RequestAndGetRelatedInfoFunc = typeof requestAndGetRelatedInfo;
/**
 * @deprecated by requestAndGetResponseInfo
 * @param requestOptions
 * @param responseConfig
 * @returns
 */
export async function requestAndGetRelatedInfo<ResData = any, Payload extends ConnectionPayload = any>(
  requestOptions: HttpRequestOptions<Payload>,
  responseConfig?: ParseHttpResponseOptions
): Promise<SendRequestWithResponseInfoResult<ResData>> {
  return await requestAndGetResponseInfo(requestOptions, responseConfig);
}

export async function requestAndGetUpgradeInfo<Payload extends ConnectionPayload = any>(
  config: HttpRequestOptions<Payload>
): Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}> {
  const {} = config;
  const headers = convertKeyToLowerCase({...(config.headers ?? {})});
  const {connection, upgrade} = headers;
  if (upgrade === undefined) {
    throw new Error(`upgrade property should be set on headers`);
  }
  if (connection === undefined) {
    headers.connection = 'Upgrade';
  }
  const options = {
    ...config,
    headers,
  };
  const {request: clientRequest} = sendHttpRequest(options);
  return new Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}>((res, rej) => {
    clientRequest.on('response', async response => {
      rej(new Error(`Expect upgrade event, but receive response event.`));
    });
    clientRequest.on('upgrade', async (response, socket, head) => {
      res({response, socket, head});
    });
    clientRequest.on('error', error => {
      rej(error);
    });
  });
}

export async function upgradeToWebsocket(options: HttpRequestOptions) {
  const headers = {...(options.headers ?? {})};
  const {connection, upgrade, 'sec-websocket-key': key} = headers;
  if (!connection) {
    headers.connection = 'Upgrade';
  }
  if (!upgrade) {
    headers.upgrade = 'websocket';
  }
  if (!key) {
    headers['sec-websocket-key'] = getRandomBase64String(23);
  }
  const finalOptions = {
    ...options,
    headers,
  };
  const result = await requestAndGetUpgradeInfo(finalOptions);
  return {
    ...result,
    requestOptions: options,
  };
}

export async function requestAndGetConnectInfo<Payload extends ConnectionPayload = any>(
  config: HttpRequestOptions<Payload>
): Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}> {
  const {urlProps, restProps} = getUrlPropsFromConfig(config);
  const {data, ...requestOptions} = restProps;
  let clientRequest: http.ClientRequest | null = null;
  const {protocol, href} = toUrlInstance(urlProps);
  clientRequest = (protocol === 'https:' ? https : http).request(href, {
    ...requestOptions,
    method: 'connect',
  });
  clientRequest.end(data ? await convertToBuffer(data) : undefined);
  return new Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}>((res, rej) => {
    clientRequest.on('response', async response => {
      rej(new Error(`Expect upgrade event, but receive response event.`));
    });
    clientRequest.on('connect', async (response, socket, head) => {
      res({response, socket, head});
    });
    clientRequest.on('error', error => {
      rej(error);
    });
  });
}

export function httpRequestOptionsToCurlCommand(options: HttpRequestOptions) {
  const {urlProps, restProps} = getUrlPropsFromConfig(options);
  const href = urlPropsToHref(urlProps);
  const {method = 'GET', headers = {}, data} = restProps;
  const command = [
    'curl',
    `-X ${method.toUpperCase()}`,
    href,
    ...Object.entries(headers).map(([k, v]) => {
      return `-H '${k}: ${v}'`;
    }),
    data !== undefined ? `-d ${isObject(data) ? "'" + JSON.stringify(data) + "'" : data}` : '',
  ].join(' ');
  return command;
}
export function responseErrorToCurlCommand(err: ResponseError) {
  if (!err.isResponseError) {
    return err;
  }
  return httpRequestOptionsToCurlCommand(err.requestOptions);
}

export function makeSureHttpRequestOptionsSerializable(options: HttpRequestOptions) {
  const {agent, ...restProps} = options;
  return restProps;
}
