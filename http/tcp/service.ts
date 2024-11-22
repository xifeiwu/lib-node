import {IncomingHttpHeaders, OutgoingHttpHeaders} from 'http';
import {toBuffer, convertToBuffer} from '../../transform';
import {CanConvertToBuffer, HttpResponseInfo, HttpRequestInfo} from '../../types';
import {convertKeyToLowerCase, getContentTypeByData} from '../service';

export function tcpResponsePropsToBuffer(info: HttpResponseInfo): Buffer {
  let {httpVersion, statusCode, statusMessage, headers, data} = info;
  let bufferArray: CanConvertToBuffer[] = [];
  if (!/^http\//i.test(httpVersion)) {
    httpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine =
    [httpVersion, statusCode, statusMessage].map(it => String(it).toUpperCase()).join(' ') + '\r\n';
  if (data) {
    const dataBuffer = toBuffer(data);
    headers['content-length'] = dataBuffer.byteLength + '';
    headers['connection'] = 'close';
    bufferArray.push(dataBuffer);
  }

  const headersLine = Object.entries(headers)
    .map(([key, value]) => {
      return `${key}: ${value}` + '\r\n';
    })
    .join('');
  const headerStr = firstLine + headersLine + '\r\n';
  bufferArray.unshift(headerStr);
  return toBuffer(bufferArray);
}

function httpInfoToBuffer(
  firstLine: string,
  restInfo?: {headers?: IncomingHttpHeaders | OutgoingHttpHeaders; data?: CanConvertToBuffer}
) {
  const {headers: _headers, data} = restInfo;
  const headers = convertKeyToLowerCase(_headers);
  if (!headers['content-type'] && data) {
    headers['content-type'] = getContentTypeByData(data);
  }
  const bufferOfData = convertToBuffer(data);
  if (bufferOfData.byteLength > 0) {
    headers['content-length'] = bufferOfData.byteLength + '';
  } else {
    headers['content-length'] = 0 + '';
  }
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
