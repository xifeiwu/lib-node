import {IncomingHttpHeaders, OutgoingHttpHeaders} from 'http';
import {toBuffer, convertToBuffer} from '../../transform';
import {CanConvertToBuffer, HttpResponseInfo, HttpRequestInfo} from '../../types';
import {convertKeyToLowerCase, getContentTypeByData} from '../service';

/**
 * @deprecated by httpResponseInfoToBuffer
 * @param info
 */
export function tcpResponsePropsToBuffer(info: HttpResponseInfo) {}

function httpInfoToBuffer(
  firstLine: string,
  restInfo?: {headers?: IncomingHttpHeaders | OutgoingHttpHeaders; data?: CanConvertToBuffer}
) {
  const {headers, data} = restInfo;
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

// const headers = convertKeyToLowerCase(_headers);
// if (!headers['content-type'] && data) {
//   headers['content-type'] = getContentTypeByData(data);
// }
// const bufferOfData = convertToBuffer(data);
// if (bufferOfData.byteLength > 0) {
//   headers['content-length'] = bufferOfData.byteLength + '';
// } else {
//   headers['content-length'] = 0 + '';
// }