import http from 'http';
import https from 'https';
import querystring, {ParsedUrlQueryInput} from 'querystring';
import {fromBuffer, toBuffer} from '../../transform';
import {Socket} from 'net';
import {getContentTypeByData, getIncomingMessageData, convertKeyToLowerCase} from '../service';
import {
  toUrlInstance,
  getUrlPropsFromConfig,
  deepMerge,
  urlPropsToHref,
  isObject,
  getRandomBase64String,
} from '../../external';
import {
  HttpRequestOptions,
  HttpResponseInfo,
  HttpRequestPayload,
  ValidateStatus,
} from '../../types';
import {Readable, isReadable} from 'stream';
import {getHttpResponseInfo} from './receiver';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

export function mergeHttpRequestOptions(
  options1: HttpRequestOptions,
  options2?: HttpRequestOptions
): HttpRequestOptions {
  if (options2 === undefined) {
    return options1;
  }
  const {headers: headers1 = {}, ...restOptions1} = options1;
  const {headers: headers2, ...restOptions2} = options2;
  const mergedHeaders = deepMerge(headers1, headers2);
  return {
    ...restOptions1,
    ...restOptions2,
    headers: mergedHeaders,
  };
}

/**
 * Should set content-length if clientRequest.write(no need when call clientRequest.end)
 * @param options
 * @returns
 */
export function sendHttpRequest<Payload extends HttpRequestPayload = any>(
  options: HttpRequestOptions<Payload>
) {
  const {urlProps, restProps} = getUrlPropsFromConfig(options);
  const {data, headers: _headers = {}, ...requestOptions} = restProps;
  const headers = convertKeyToLowerCase(_headers);
  let finalData: HttpRequestPayload = data as Buffer;
  const dataIsUndefined = data === undefined;
  const dataIsReadable = isReadable(finalData as unknown as Readable);
  // requestOptions.headers['connection'] = 'keep-alive';
  if (!dataIsUndefined) {
    if (dataIsReadable) {
      if (!headers['transfer-encoding']) {
        headers['transfer-encoding'] = 'chunked';
      }
    } else {
      const contentType = headers['content-type'] ?? getContentTypeByData(data);
      finalData = data;
      if (
        typeof contentType === 'string' &&
        contentType.includes('x-www-form-urlencoded') &&
        isObject(data)
      ) {
        finalData = querystring.stringify(finalData as ParsedUrlQueryInput);
      }
      finalData = toBuffer(finalData);
      headers['content-length'] = (finalData as Buffer).byteLength;
      headers['content-type'] = contentType;
    }
  }
  let clientRequest: http.ClientRequest | null = null;
  const {protocol, href} = toUrlInstance(urlProps);
  const mergedRequestOptions = {...requestOptions, headers};
  clientRequest = (protocol === 'https:' ? https : http).request(href, mergedRequestOptions);

  if (dataIsUndefined) {
    clientRequest.end();
  } else {
    if (dataIsReadable) {
      (finalData as unknown as Readable).pipe(clientRequest);
    } else {
      clientRequest.write(finalData);
    }
  }
  return clientRequest;
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

export async function requestAndGetResponse<Payload extends HttpRequestPayload = any>(
  options: HttpRequestOptions<Payload>
): Promise<http.IncomingMessage> {
  const clientRequest = sendHttpRequest(options);
  return new Promise((res, rej) => {
    clientRequest.on('response', async response => {
      res(response);
    });
    clientRequest.on('upgrade', async response => {
      rej(new Error(`Expect response event, but receive upgrade event.`));
    });
    clientRequest.on('timeout', () => {
      /**
       * timeout will be triggered when time-cost of request larger than timeout setted options
       * But it will not stop request process, or trigger error
       */
      // console.log('timeout');
      // clientRequest.destroy();
    });
    clientRequest.on('error', error => {
      rej(error);
    });
  });
}

export const validateStatusCode: ValidateStatus = info => {
  const {statusCode} = info;
  return statusCode >= 200 && statusCode < 300;
};

export type RequestAndGetResponseInfoFunc = typeof requestAndGetResponseInfo;
export async function requestAndGetResponseInfo<ResData = any, Payload extends HttpRequestPayload = any>(
  requestOptions: HttpRequestOptions<Payload>,
  responseConfig?: Parameters<typeof getHttpResponseInfo>[1] & {
    validateStatus?: ValidateStatus | boolean;
  }
): Promise<HttpResponseInfo<ResData>> {
  const response = await requestAndGetResponse<Payload>(requestOptions);
  let {validateStatus, ...resConfig} = responseConfig ?? {};
  const responseInfo = await getHttpResponseInfo<ResData>(response, resConfig);

  if (validateStatus) {
    if (validateStatus === true) {
      validateStatus = validateStatusCode;
    }

    if (!validateStatus(responseInfo)) {
      throw new ResponseError(requestOptions, responseInfo);
    }
  }
  return responseInfo;
}

export type RequestAndGetRelatedInfoFunc = typeof requestAndGetRelatedInfo;
export async function requestAndGetRelatedInfo<ResData = any, Payload extends HttpRequestPayload = any>(
  requestOptions: HttpRequestOptions<Payload>,
  responseConfig?: Parameters<typeof getHttpResponseInfo>[1] & {
    validateStatus?: ValidateStatus | boolean;
  }
): Promise<{requestOptions: HttpRequestOptions<Payload>; responseInfo: HttpResponseInfo<ResData>}> {
  const responseInfo = await requestAndGetResponseInfo(requestOptions, responseConfig);
  return {requestOptions, responseInfo};
}

export async function requestAndGetUpgradeInfo<Payload extends HttpRequestPayload = any>(
  config: HttpRequestOptions<Payload>
): Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}> {
  const {} = config;
  const headers = {...(config.headers ?? {})};
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
  const clientRequest = sendHttpRequest(options);
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

export async function requestAndGetConnectInfo<Payload extends HttpRequestPayload = any>(
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
  clientRequest.end(data ? await toBuffer(data) : undefined);
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
