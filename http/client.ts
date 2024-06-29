import http from 'http';
import https from 'https';
import {toBuffer} from '../transform';
import {Socket} from 'net';
import {getResponseInfo} from './common';
import {
  UrlProps,
  toUrlInstance,
  getUrlPropsFromConfig,
  deepMerge,
  urlPropsToHref,
  isObject,
} from '../external';
import {HttpResponseProps} from '../types';
import {Readable, isReadable} from 'stream';

type ToBufferParams = Parameters<typeof toBuffer>[0] | Readable;

/**
 * A very simple request options can be used for both HttpRequest and AxiosRequest
 */
export interface GeneralRequestOptions<Payload extends ToBufferParams = any> extends UrlProps {
  method?: string | undefined;
  data?: Payload;
}
/**
 * A custom requestOptions based on http.RequestOptions, and used for requestAndGetResponse function.
 */
export interface HttpRequestOptions<Payload extends ToBufferParams = any>
  extends http.RequestOptions,
    GeneralRequestOptions<Payload> {}

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

export async function requestAndGetResponse<Payload extends ToBufferParams = any>(
  config: HttpRequestOptions<Payload>
): Promise<http.IncomingMessage> {
  const {urlProps, restProps} = getUrlPropsFromConfig(config);
  const {data, ...requestOptions} = restProps;
  let clientRequest: http.ClientRequest | null = null;
  const {protocol, href} = toUrlInstance(urlProps);
  // console.log(`href`);
  // console.log(href);
  // console.log(requestOptions);
  clientRequest = (protocol === 'https:' ? https : http).request(href, requestOptions);
  if (isReadable(data as Readable)) {
    (data as Readable).pipe(clientRequest);
  } else {
    clientRequest.end(data ? await toBuffer(data) : undefined);
  }
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

export type ValidateStatus = (responseInfo: HttpResponseProps) => boolean;
export const validateStatusCode: ValidateStatus = info => {
  const {statusCode} = info;
  return statusCode >= 200 && statusCode < 300;
};

export type RequestAndGetRelatedInfoFunc = typeof requestAndGetRelatedInfo;
export async function requestAndGetRelatedInfo<ResData = any, Payload extends ToBufferParams = any>(
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
export async function requestAndGetResponseInfo<ResData = any, Payload extends ToBufferParams = any>(
  requestOptions: HttpRequestOptions<Payload>,
  responseConfig?: Parameters<typeof getResponseInfo>[1] & {
    validateStatus?: ValidateStatus | boolean;
  }
): Promise<HttpResponseProps<ResData>> {
  const {responseInfo} = await requestAndGetRelatedInfo(requestOptions, responseConfig);
  return responseInfo;
}

export async function requestAndGetUpgradeInfo<Payload extends ToBufferParams = any>(
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

export async function requestAndGetConnectInfo<Payload extends ToBufferParams = any>(
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

// export function defaultResponse(response: http.ServerResponse) {
//   response.writeHead(200, {
//     'Content-Type': 'html'
//   });
//   fs.createReadStream(path.resolve(__dirname, 'net.html')).pipe(response);
// }
// export function startBasicServer(cb) {
//   let HTTPPORT = 0;
//   let server = http.createServer((request, response) => {
//     // this.showRequest(request);
//     if (typeof(cb) !== 'function') {
//       defaultResponse(response);
//     } else {
//       cb(request, response);
//     }
//   });
//   server.listen(HTTPPORT);
//   server.on('listening', () => {
//     let port = server.address().port;
//     let localIP = this.getLocalIP();
//     console.log(`start at: http://${localIP}:${port}`);
//   })
// }

// getParsedUrl(request) {
//   // const
//   var urlString = 'http://' + request.headers['host'] + request.url;
//   var obj = url.parse(urlString);
//   if (obj.query) {
//     obj.query = this.parseQueryString(obj.query);
//   }
//   return obj;
// }

// /**
//  * @param {ctx}, ctx of koa
//  * @param {next}, ctx of next
//  * @param {prefix}, filter url started with prefix
//  * @param {refDir}, the start dir from which to search target file
//  */
// export async function koaMiddlewareResponseStatic(ctx, next, prefix, refDir = __dirname) {
//   const url = ctx.url;

//   if (url.startsWith(prefix)) {
//     return await next();
//   }
//   const targetFile = this.findClosestFile(refDir, url.replace('/', ''));
//   if (!targetFile) {
//     return await next();
//   }
//   const statInfo = fs.statSync(targetFile);
//   if (statInfo.isDirectory() && !url.endsWith('/')) {
//     ctx.redirect(`${url}/`);
//     return;
//   }
//   const resStream = await this.getFileStream4Response(targetFile);
//   if (resStream) {
//     if (statInfo.isDirectory()) {
//       ctx.type = 'html';
//     } else if (statInfo.isFile()) {
//       ctx.type = targetFile.split('.').pop();
//     }
//     ctx.body = resStream;
//   } else {
//     return await next();
//   }
// }
