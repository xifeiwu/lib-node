import http from 'http';
import https from 'https';
import {toBuffer} from '../transform';
import {Socket} from 'net';
import {getResponseInfo} from './common';
import {toUrlInstance, getUrlPropsFromConfig, deepMerge, urlPropsToHref, isObject} from '../external';
import {HttpRequestOptions, HttpResponseProps, HttpRequestPayload, ValidateStatus} from '../types';
import {Readable, isReadable} from 'stream';

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

export function sendHttpRequest<Payload extends HttpRequestPayload = any>(
  options: HttpRequestOptions<Payload>
) {
  const {urlProps, restProps} = getUrlPropsFromConfig(options);
  const {data, ...requestOptions} = restProps;
  // requestOptions.headers['connection'] = 'keep-alive';
  let clientRequest: http.ClientRequest | null = null;
  const {protocol, href} = toUrlInstance(urlProps);
  clientRequest = (protocol === 'https:' ? https : http).request(href, requestOptions);
  if (isReadable(data as Readable)) {
    (data as Readable).pipe(clientRequest);
  } else {
    clientRequest.end(data ? toBuffer(data) : undefined);
  }
  return clientRequest;
}

export class ResponseError extends Error {
  isResponseError: boolean = true;
  requestConfig: HttpRequestOptions;
  responseInfo: HttpResponseProps;
  constructor(requestConfig: HttpRequestOptions, responseInfo: HttpResponseProps) {
    const {statusCode, statusMessage} = responseInfo;
    super(`Response code ${statusCode}: ${statusMessage}`);
    this.requestConfig = requestConfig;
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

export type RequestAndGetRelatedInfoFunc = typeof requestAndGetRelatedInfo;
export async function requestAndGetRelatedInfo<ResData = any, Payload extends HttpRequestPayload = any>(
  requestOptions: HttpRequestOptions<Payload>,
  responseConfig?: Parameters<typeof getResponseInfo>[1] & {
    validateStatus?: ValidateStatus | boolean;
  }
): Promise<{requestOptions: HttpRequestOptions<Payload>; responseInfo: HttpResponseProps<ResData>}> {
  const response = await requestAndGetResponse<Payload>(requestOptions);
  let {validateStatus, ...resConfig} = responseConfig ?? {};
  const responseInfo = await getResponseInfo<ResData>(response, resConfig);

  if (validateStatus) {
    if (validateStatus === true) {
      validateStatus = validateStatusCode;
    }

    if (!validateStatus(responseInfo)) {
      throw new ResponseError(requestOptions, responseInfo);
    }
  }
  return {requestOptions, responseInfo};
}

export type RequestAndGetResponseInfoFunc = typeof requestAndGetResponseInfo;
export async function requestAndGetResponseInfo<ResData = any, Payload extends HttpRequestPayload = any>(
  requestOptions: HttpRequestOptions<Payload>,
  responseConfig?: Parameters<typeof getResponseInfo>[1] & {
    validateStatus?: ValidateStatus | boolean;
  }
): Promise<HttpResponseProps<ResData>> {
  const {responseInfo} = await requestAndGetRelatedInfo(requestOptions, responseConfig);
  return responseInfo;
}

export async function requestAndGetUpgradeInfo<Payload extends HttpRequestPayload = any>(
  config: HttpRequestOptions<Payload>
): Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}> {
  const {urlProps, restProps} = getUrlPropsFromConfig(config);
  const {data, headers = {}, ...requestOptions} = restProps;
  let clientRequest: http.ClientRequest | null = null;
  const {protocol, href} = toUrlInstance(urlProps);
  clientRequest = (protocol === 'https:' ? https : http).request(href, {
    ...requestOptions,
    headers: {
      ...headers,
      'sec-websocket-key': '50P3cqzG82BIWURMgMisUg==',
      connection: 'Upgrade',
      upgrade: 'websocket',
    },
  });
  clientRequest.end(data ? await toBuffer(data) : undefined);
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

export function makeSureHttpRequestOptionsSerializable(options: HttpRequestOptions) {
  const {agent, ...restProps} = options;
  return restProps;
}
