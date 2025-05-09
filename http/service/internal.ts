import {isReadable, Readable} from 'stream';
import {HttpRequestInfo, HttpResponseInfo} from '../../types';
import {convertKeyToLowerCase, isPlainObject} from '../../external';
import {inferContentTypeByData} from './common';
import {OutgoingHttpHeaders} from 'http';

/**
 * For consideration of why updateHeaders on httpInfo layer?
 * For logic general and compatibility, this logic is added in lower layer
 *
 * For key content-length, transfer-encoding of header part, there are some related logic on node http module
 * 1. When request.end() is called, http module knows the byteLength of body, and set it as value of content-length
 * 2. When request.write() called multpile times, `chunked` will be set as value of transfer-encoding
 * But there is no special logic for content-type, to avoid set headers.content-type on every httpRequestOptions,
 * if the content-type is not set, it can be referred by function getContentTypeByData
 *
 * Change log:
 * 1. Not do data convert
 * 2. Not set content-length, as content-length depends on the final expression of data
 */
export function updateHeadersByHttpInfo(
  info: Partial<HttpRequestInfo> | Partial<HttpResponseInfo>,
  options?: {
    /** set header if not exist */
    supplementHeaders?: OutgoingHttpHeaders;
  }
) {
  const {headers: _headers = {}, data} = info;
  const headers = convertKeyToLowerCase(_headers);
  const {supplementHeaders} = options ?? {};
  const dataIsUndefined = data === undefined;
  let dataIsReadable = false;
  if (!dataIsUndefined) {
    dataIsReadable = isReadable(data as Readable);
    if (!dataIsReadable) {
      if (!headers['content-type']) {
        headers['content-type'] = inferContentTypeByData(data);
      }
    }
  }

  if (isPlainObject(supplementHeaders)) {
    for (const [key, value] of Object.entries(supplementHeaders)) {
      if (!Object.prototype.hasOwnProperty.call(headers, key.toLowerCase())) {
        headers[key] = value;
      }
    }
  }
  return {
    dataIsUndefined,
    dataIsReadable,
    headers,
  };
}
