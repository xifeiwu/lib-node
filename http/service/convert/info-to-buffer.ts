import {
  HttpRequestInfo,
  HttpCommonInfo,
  HttpResponseInfo,
  ConnectionRole,
  CanConvertToBuffer,
  HttpRequestFirstLineInfo,
  HttpRequestHeaderPartInfo,
  HttpResponseFirstLineInfo,
  HttpResponseHeaderPartInfo,
} from '../../../types';
import {updateHeadersByHttpInfo} from '../internal';
import {convertToBuffer} from '../../../transform';
import {OutgoingHttpHeaders, STATUS_CODES} from 'http';
import {LINE_BREAK} from '../common';
import {PickPartial} from '../../../types/external';

function getHttpVersion(httpVersion?: string) {
  if (!httpVersion) {
    return 'HTTP/1.1';
  }
  if (!/^http\//i.test(httpVersion)) {
    return 'HTTP/' + httpVersion;
  }
  return httpVersion;
}

function httpHeaderToString(key: string, value: string | number) {
  return key + ': ' + value;
}
function headersToString(headers?: OutgoingHttpHeaders) {
  if (!headers) {
    return '';
  }
  const lines: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      lines.push(...value.map(it => httpHeaderToString(key, it)));
    } else {
      lines.push(httpHeaderToString(key, value));
    }
  }
  return lines.join(LINE_BREAK) + LINE_BREAK;
}

function httpCommonInfoToBuffer(
  firstLine: string,
  commonInfo?: HttpCommonInfo<CanConvertToBuffer>,
  options?: {adaptHeaders?: boolean; supplementHeaders?: OutgoingHttpHeaders}
) {
  const {adaptHeaders, supplementHeaders} = options ?? {};
  const {headers} = adaptHeaders ? updateHeadersByHttpInfo(commonInfo, {supplementHeaders}) : commonInfo;
  const finalData = convertToBuffer(commonInfo.data);
  return convertToBuffer(firstLine + '\r\n', headersToString(headers), '\r\n', finalData);
}

function requestFirstLineToString(firstLineInfo: PickPartial<HttpRequestFirstLineInfo, 'httpVersion'>) {
  const {method = 'get', url = '/', httpVersion} = firstLineInfo;
  return [method.toUpperCase(), url, getHttpVersion(httpVersion)].join(' ');
}

export function httpRequestInfoToBuffer(
  requestInfo: PickPartial<HttpRequestInfo<CanConvertToBuffer>, 'httpVersion'>,
  options?: {
    /**
     * if role is sender, will adapt header part by existing request info
     * To avoid confusion, not adaptHeaders as default.
     */
    role?: ConnectionRole;
    supplementHeaders?: OutgoingHttpHeaders;
  }
) {
  const {role, supplementHeaders} = options ?? {};
  const {headers, data} = requestInfo;
  const content = httpCommonInfoToBuffer(
    requestFirstLineToString(requestInfo),
    {headers, data},
    {adaptHeaders: role === 'sender', supplementHeaders}
  );
  return content;
}

function responseFirstLineToString(
  firstLine: PickPartial<HttpResponseFirstLineInfo, 'httpVersion' | 'statusMessage'>
) {
  const {httpVersion, statusCode = 200} = firstLine;
  const statusMessage = firstLine.statusMessage ?? STATUS_CODES[statusCode];
  return [getHttpVersion(httpVersion), statusCode, statusMessage].join(' ');
}
export function httpResponseHeaderPartInfoToBuffer(
  info: PickPartial<HttpResponseHeaderPartInfo, 'httpVersion' | 'statusMessage'>
) {
  return convertToBuffer(
    responseFirstLineToString(info),
    LINE_BREAK,
    headersToString(info.headers),
    LINE_BREAK
  );
}

export function httpResponseInfoToBuffer(
  responseInfo: PickPartial<HttpResponseInfo<CanConvertToBuffer>, 'httpVersion' | 'statusMessage'>,
  options?: {
    role?: ConnectionRole;
  }
) {
  const {role} = options ?? {};
  const {headers = {}, data} = responseInfo;
  return httpCommonInfoToBuffer(
    responseFirstLineToString(responseInfo),
    {headers, data},
    {adaptHeaders: role === 'sender'}
  );
}

/**
 * Not include logic for twist headers
 */
export function httpRequestHeaderPartInfoToBuffer(
  info: PickPartial<HttpRequestHeaderPartInfo, 'httpVersion'>
) {
  return convertToBuffer(
    requestFirstLineToString(info),
    LINE_BREAK,
    headersToString(info.headers),
    LINE_BREAK
  );
}
