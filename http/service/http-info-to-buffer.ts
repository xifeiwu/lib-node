import {isReadable} from 'stream';
import {
  HttpRequestInfo,
  HttpCommonInfo,
  HttpResponseInfo,
  ConnectionRole,
  CanConvertToBuffer,
} from '../../types';
import {updateHeadersByHttpInfo} from './internal';
import {convertToBuffer} from '../../transform';
import {getDataFromReadable} from '../../stream';
import {STATUS_CODES} from 'http';

type HttpRequestInfoWithOptionalHttpVersion<DataType = any> = Omit<HttpRequestInfo<DataType>, 'httpVersion'> &
  Partial<Pick<HttpRequestInfo<DataType>, 'httpVersion'>>;

type HttpResponseInfoWithOptionalHttpVersionAndStatusMessage<
  DataType = any,
  Role extends ConnectionRole = 'receiver'
> = Omit<HttpResponseInfo<DataType, ConnectionRole>, 'httpVersion' | 'statusMessage'> &
  Partial<Pick<HttpResponseInfo<DataType, ConnectionRole>, 'httpVersion' | 'statusMessage'>>;

async function httpCommonInfoToBufferAsync(
  firstLine: string,
  commonInfo?: HttpCommonInfo,
  options?: {adaptHeaders?: boolean}
) {
  const {adaptHeaders = true} = options ?? {};
  const {headers: originHeaders, data: originData} = commonInfo;
  /** Convert data to buffer */
  let finalData: Buffer;
  if (originData) {
    if (isReadable(originData)) {
      finalData = await getDataFromReadable(originData);
    } else {
      finalData = convertToBuffer(originData);
    }
  }
  const {headers, data} = adaptHeaders
    ? updateHeadersByHttpInfo({
        headers: originHeaders,
        data: finalData,
      })
    : commonInfo;
  const headerLines = Object.entries(headers)
    .map(([key, value]) => {
      return key + ': ' + value + '\r\n';
    })
    .join('');

  return convertToBuffer(firstLine, '\r\n', headerLines, '\r\n', data);
}

export async function httpResponseInfoToBufferAsync(
  responseInfo: HttpResponseInfo,
  options?: {
    role?: ConnectionRole;
  }
) {
  const {role = 'sender'} = options ?? {};
  const {httpVersion = 'HTTP/1.1', statusCode = 200, statusMessage = 'OK', headers = {}, data} = responseInfo;
  // http.STATUS_CODES
  let finalHttpVersion = httpVersion;
  if (!/^http\//i.test(httpVersion)) {
    finalHttpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [finalHttpVersion, statusCode, statusMessage].join(' ').toUpperCase();
  return await httpCommonInfoToBufferAsync(firstLine, {headers, data}, {adaptHeaders: role === 'sender'});
}

export async function httpRequestInfoToBufferAsync(
  requestInfo: HttpRequestInfoWithOptionalHttpVersion,
  options?: {
    role?: ConnectionRole;
  }
) {
  const {role = 'sender'} = options ?? {};
  const {method, url, httpVersion, headers, data} = requestInfo;
  let finalHttpVersion = httpVersion;
  if (!/^http\//i.test(httpVersion)) {
    finalHttpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [method, url, finalHttpVersion].join(' ').toUpperCase();
  return await httpCommonInfoToBufferAsync(firstLine, {headers, data}, {adaptHeaders: role === 'sender'});
}

function httpCommonInfoToBuffer(
  firstLine: string,
  commonInfo?: HttpCommonInfo<CanConvertToBuffer>,
  options?: {adaptHeaders?: boolean}
) {
  const {adaptHeaders = true} = options ?? {};
  const {headers: originHeaders, data: originData} = commonInfo;
  const finalData = convertToBuffer(originData);
  const {headers, data} = adaptHeaders
    ? updateHeadersByHttpInfo({
        headers: originHeaders,
        data: finalData,
      })
    : commonInfo;
  const headerLines = Object.entries(headers)
    .map(([key, value]) => {
      return key + ': ' + value + '\r\n';
    })
    .join('');

  return convertToBuffer(firstLine, '\r\n', headerLines, '\r\n', data);
}

export function httpResponseInfoToBuffer(
  responseInfo: HttpResponseInfoWithOptionalHttpVersionAndStatusMessage<CanConvertToBuffer>,
  options?: {
    role?: ConnectionRole;
  }
) {
  const {role = 'sender'} = options ?? {};
  const {httpVersion = 'HTTP/1.1', statusCode = 200, headers = {}, data} = responseInfo;
  const statusMessage = responseInfo.statusMessage ?? STATUS_CODES[statusCode];
  let finalHttpVersion = httpVersion;
  if (!/^http\//i.test(httpVersion)) {
    finalHttpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [finalHttpVersion, statusCode, statusMessage].join(' ').toUpperCase();
  return httpCommonInfoToBuffer(firstLine, {headers, data}, {adaptHeaders: role === 'sender'});
}

export function httpRequestInfoToBuffer(
  requestInfo: HttpRequestInfoWithOptionalHttpVersion<CanConvertToBuffer>,
  options?: {
    role?: ConnectionRole;
  }
) {
  const {role = 'sender'} = options ?? {};
  const {method, url, httpVersion = '1.1', headers, data} = requestInfo;
  let finalHttpVersion = httpVersion;
  if (!/^http\//i.test(httpVersion)) {
    finalHttpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [method, url, finalHttpVersion].join(' ').toUpperCase();
  return httpCommonInfoToBuffer(firstLine, {headers, data}, {adaptHeaders: role === 'sender'});
}
// import http2 from 'node:crypto';
