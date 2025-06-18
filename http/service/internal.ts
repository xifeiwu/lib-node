import {isReadable, Readable} from 'stream';
import {convertKeyToLowerCase, isPlainObject} from '../../external';
import {inferContentTypeByData} from './common';
import {OutgoingHttpHeaders} from 'http';
import {HttpCommonInfo} from '../../types';

/**
 * This function is mainly used to add content-type to headers part if it's value is undefined
 *
 * For http
 * For key content-length, transfer-encoding of header part, there are some related logic on node http module
 * 1. When request.end() is called, http module knows the byteLength of body, and set it as value of content-length
 * 2. When request.write() called multpile times, `chunked` will be set as value of transfer-encoding
 *
 * For tcp
 * the http action over socket should be wrapped by HttpIncomingMessage or HttpOutgoingMessage,
 * content-length, transfer-encoding should be set or update before payload sending.
 * Here is not a good place to set content-length, transfer-encoding, because their values depends on final data.
 *
 * But there is no special logic for content-type, to avoid set headers.content-type on every httpRequestOptions,
 * if the content-type is not set, refer it by inferContentTypeByData
 *
 * Change log:
 * 1. Not do data convert
 * 2. Not set content-length, as content-length depends on the final data format
 *
 * TODO:
 * As it's only used for sendHttpRequest, it may move to http/client/send as a internal function
 */
export function updateHeadersByHttpInfo(
  info: HttpCommonInfo,
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
