import http from 'http';
import {ConnectionPayload, HttpResponseInfo} from '../../../types';
import {Readable} from 'stream';
import {convertToBuffer} from '../../../transform';
import {updateHeadersByHttpInfo} from '../../tcp';
import {getHttpRequestInfo} from './receive';

export function sendHttpResponse<Payload extends ConnectionPayload = any>(
  response: http.ServerResponse,
  responseInfo: Partial<HttpResponseInfo<Payload>>
) {
  const {statusCode, statusMessage, headers = {}, data} = responseInfo;
  const {dataIsUndefined, dataIsReadable, headers: finalHeaders} = updateHeadersByHttpInfo({headers, data});
  for (const [key, value] of Object.entries({statusCode, statusMessage})) {
    if (value !== undefined) {
      response[key] = value;
    }
  }
  for (const [name, value] of Object.entries(finalHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        response.setHeader(name, item);
      }
    } else {
      response.setHeader(name, value);
    }
  }
  if (dataIsUndefined) {
    response.end();
  } else {
    if (dataIsReadable) {
      (data as Readable).pipe(response);
    } else {
      response.write(convertToBuffer(data));
    }
  }
  return response;
}

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
 * Test buffer content of empty response
 */
export function responseEmpty(response: http.ServerResponse) {
  response.statusCode = 404;
  response.statusMessage = 'Not Found';
  response.setHeader('content-type', 'text/plain');
  response.end('');
}

export function response404(response: http.ServerResponse) {
  response.statusCode = 404;
  response.statusMessage = 'Not Found';
  response.setHeader('content-type', 'text/plain');
  response.end('NOT Found');
}

export function responseHtml(response: http.ServerResponse, html: string) {
  response.statusCode = 200;
  response.statusMessage = 'OK';
  response.setHeader('content-type', 'text/html');
  response.end(html);
}

export function responseServerEnv(response: http.ServerResponse) {
  response.statusCode = 200;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  const env = process.env;
  response.end(JSON.stringify(env));
}
