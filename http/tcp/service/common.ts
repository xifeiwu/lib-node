/**
 * Logic that can be used on both client and server
 */
import {convertToBuffer} from '../../../transform';
import querystring, {ParsedUrlQueryInput} from 'querystring';
import {HttpResponseInfo, HttpRequestInfo, HttpCommonInfo, ConnectionPayload} from '../../../types';
import {convertKeyToLowerCase} from '../../service/common';
import {isReadable, Readable} from 'stream';
import {isObject} from '../../../external';

/**
 * @deprecated by httpResponseInfoToBuffer
 * @param info
 */
export function tcpResponsePropsToBuffer(info: HttpResponseInfo) {}

/**
 * supplement some logic existed in http modules
 * @param info
 * @returns
 */
function updateHeadersByHttpInfo(info: HttpCommonInfo) {
  const {headers: _headers, data} = info;

  const headers = convertKeyToLowerCase(_headers);
  if (!data) {
    return info;
  }
  // if (!headers['content-type']) {
  //   headers['content-type'] = getContentTypeByData(data);
  // }
  let finalData: ConnectionPayload = data;
  const dataIsReadable = isReadable(finalData as Readable);
  if (dataIsReadable) {
    if (!headers['transfer-encoding']) {
      headers['transfer-encoding'] = 'chunked';
    }
  } else {
    finalData = data;
    const contentType = headers['content-type'];
    if (contentType) {
      if (
        typeof contentType === 'string' &&
        contentType.includes('x-www-form-urlencoded') &&
        isObject(data)
      ) {
        finalData = querystring.stringify(finalData as ParsedUrlQueryInput);
      }
    }
    finalData = convertToBuffer(finalData);
    if (!headers['content-length']) {
      headers['content-length'] = (finalData as Buffer).byteLength;
    }
  }
  return {headers, data: finalData};
}

function httpInfoToBuffer(firstLine: string, commonInfo?: HttpCommonInfo, options?: {preTreat?: boolean}) {
  const {preTreat = true} = options ?? {};
  const {headers, data} = preTreat ? updateHeadersByHttpInfo(commonInfo) : commonInfo;
  const headerLines = Object.entries(headers)
    .map(([key, value]) => {
      return key + ': ' + value + '\r\n';
    })
    .join('');
  return convertToBuffer(firstLine, '\r\n', headerLines, '\r\n', data);
}

export function httpResponseInfoToBuffer(responseInfo: Partial<HttpResponseInfo>) {
  const {httpVersion = 'HTTP/1.1', statusCode = 200, statusMessage = 'OK', headers = {}, data} = responseInfo;
  let finalHttpVersion = httpVersion;
  if (!/^http\//i.test(httpVersion)) {
    finalHttpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [finalHttpVersion, statusCode, statusMessage].join(' ').toUpperCase();
  return httpInfoToBuffer(firstLine, {headers, data});
}

export function httpRequestInfoToBuffer(requestInfo: Partial<HttpRequestInfo>) {
  const {method, url, httpVersion, headers, data} = requestInfo;
  let finalHttpVersion = httpVersion;
  if (!/^http\//i.test(httpVersion)) {
    finalHttpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [method, url, finalHttpVersion].join(' ').toUpperCase();
  return httpInfoToBuffer(firstLine, {headers, data});
}
