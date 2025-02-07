import {isReadable, Readable} from 'stream';
import querystring, {ParsedUrlQueryInput} from 'querystring';
import {ConnectionPayload, HttpCommonInfo} from '../../types';
import {isObject, convertKeyToLowerCase} from '../../external';
import {convertToBuffer} from '../../transform';
import {inferContentTypeByData} from './common';

/**
 * For key content-length, transfer-encoding of header part, there are some related logic on node http module
 * 1. When request.end() is called, http module knows the byteLength of body, and set it as value of content-length
 * 2. When request.write() called multpile times, `chunk` will be set as value of transfer-encoding
 * But there is no special logic for content-type, to avoid set headers.content-type on every httpRequestOptions,
 * if the content-type is not set, it can be referred by function getContentTypeByData
 */
export function updateHeadersByHttpInfo(info: HttpCommonInfo) {
  const {headers: _headers, data} = info;
  const dataIsUndefined = data === undefined;
  let dataIsReadable = false;
  if (dataIsUndefined) {
    return {...info, dataIsUndefined, dataIsReadable};
  }

  const headers = convertKeyToLowerCase(_headers);
  let finalData: ConnectionPayload = data;
  dataIsReadable = isReadable(finalData as Readable);
  if (!dataIsReadable) {
    const contentType = headers['content-type'];
    /**
     * @deprecated by toFormUrlencoded
     * Fix for the case: content-type is x-www-form-urlencoded, but format of data is json
     */
    if (typeof contentType === 'string' && contentType.includes('x-www-form-urlencoded') && isObject(data)) {
      finalData = querystring.stringify(finalData as ParsedUrlQueryInput);
    }
    finalData = convertToBuffer(finalData);
    /** As we try to avoid close connection on client side, so must append content-length on headers */
    if (!headers['content-length']) {
      headers['content-length'] = (finalData as Buffer).byteLength;
    }
    if (!headers['content-type']) {
      headers['content-type'] = inferContentTypeByData(data);
    }
  }
  return {
    dataIsUndefined,
    dataIsReadable,
    headers,
    data: finalData,
  };
}
