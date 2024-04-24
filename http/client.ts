import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import stream from 'stream';
import {toBuffer} from '../transform';
import {Socket} from 'net';
import {getResponseInfo} from './common';
import {UrlProps, toUrlInstance, getUrlPropsFromConfig, deepMerge, urlPropsToHref} from '../external';
import {ResponseInfo} from '../types';

type ToBufferParams = Parameters<typeof toBuffer>[0];

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
  clientRequest.end(data ? await toBuffer(data) : undefined);
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
export async function requestAndGetUpgradeInfo<Payload extends ToBufferParams = any>(
  config: HttpRequestOptions<Payload>
): Promise<{response: http.IncomingMessage; socket: Socket; head: Buffer}> {
  const {url, data, ...options} = config;
  let clientRequest: http.ClientRequest | null = null;
  if (url) {
    const {protocol, href} = toUrlInstance(url);
    clientRequest = (protocol === 'https:' ? https : http).request(href, options);
  } else {
    const {protocol = 'http'} = options;
    clientRequest = (protocol === 'https:' ? https : http).request(options);
  }
  if (data) {
    clientRequest.write(await toBuffer(data));
  }
  clientRequest.end();
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

export type ValidateStatus = (responseInfo: ResponseInfo) => boolean;
export const validateStatusCode: ValidateStatus = info => {
  const {statusCode} = info;
  return statusCode >= 200 && statusCode < 300;
};
export class ResponseError extends Error {
  isResponseError: boolean = true;
  requestConfig: HttpRequestOptions;
  responseInfo: ResponseInfo;
  constructor(requestConfig: HttpRequestOptions, responseInfo: ResponseInfo) {
    const {statusCode, statusMessage} = responseInfo;
    super(`Response code ${statusCode}: ${statusMessage}`);
    this.requestConfig = requestConfig;
    this.responseInfo = responseInfo;
  }
}

export async function requestAndGetResponseInfo<ResData = any, Payload extends ToBufferParams = any>(
  config: HttpRequestOptions<Payload>,
  responseConfig?: Parameters<typeof getResponseInfo>[1] & {
    validateStatus?: ValidateStatus | boolean;
  }
) {
  const response = await requestAndGetResponse<Payload>(config);
  let {validateStatus, ...resConfig} = responseConfig ?? {};
  const responseInfo = await getResponseInfo<ResData>(response, resConfig);

  if (validateStatus) {
    if (validateStatus === true) {
      validateStatus = validateStatusCode;
    }

    if (!validateStatus(responseInfo)) {
      throw new ResponseError(config, responseInfo);
    }
  }
  return responseInfo;
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
    data ? `-d ${JSON.stringify(data)}` : '',
  ].join(' ');
  return command;
}

export function makeSureHttpRequestOptionsSerializable(options: HttpRequestOptions) {
  const {agent, ...restProps} = options;
  return restProps;
}

// return file list in the form of <ul><li></li></ul>
export function getFileListInFormOfUl(dir: string, filter?: (fileName: string) => boolean) {
  filter = filter ? filter : () => true;
  try {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error('not a directory');
    }
    const fileList = fs.readdirSync(dir);
    const liList = Array.prototype.slice
      .call(fileList)
      .filter(filter)
      .map(it => {
        let item = '';
        const statInfo = fs.statSync(path.resolve(dir, it));
        if (statInfo.isDirectory()) {
          item = `<li><a href="${it}/">${it}/</a></li>`;
        } else if (statInfo.isFile()) {
          item = `<li><a href="${it}">${it}</a></li>`;
        } else {
          item = `<li style="color: red"><a href="${it}">${it}</a></li>`;
        }
        return item;
      });
    const ul = ['<ul>', ...liList, '</ul>'].join('');
    return ul;
  } catch (err) {
    console.error(`getFileListInFormOfUl fail`);
    return [];
  }
}

export function getDirContentInFormOfHtml(dir: string, filter?: (fileName: string) => boolean) {
  const ulStr = getFileListInFormOfUl(dir, filter);
  return `<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="initial-scale=1, width=device-width, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="">
    <title>文件列表</title>
    <script>
    window.addEventListener('load', function() {
    });
    </script>
    <style>
    </style>
  </head>
  <body>
    ${ulStr}
  </body>
</html>`;
}

/**
 * response for a file or dir
 */
export async function getFileContentInFormOfStream(targetFile: string) {
  if (!targetFile) {
    return null;
  }
  if (!fs.existsSync(targetFile)) {
    return null;
  }

  const statInfo = fs.statSync(targetFile);
  if (statInfo.isDirectory()) {
    const body = getDirContentInFormOfHtml(targetFile);
    return new stream.Readable({
      read() {
        this.push(body);
        this.push(null);
      },
    });
  } else if (statInfo.isFile()) {
    return fs.createReadStream(targetFile);
  }
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
