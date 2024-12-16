import {isReadable, Readable} from 'stream';
import querystring, {ParsedUrlQueryInput} from 'querystring';
import {ConnectionPayload, HttpCommonInfo} from '../../types';
import {isObject} from '../../external';
import {convertToBuffer} from '../../transform';
import {convertKeyToLowerCase, getContentTypeByData} from './common';

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
  if (!dataIsUndefined && !dataIsReadable) {
    const contentType = headers['content-type'];
    if (typeof contentType === 'string' && contentType.includes('x-www-form-urlencoded') && isObject(data)) {
      finalData = querystring.stringify(finalData as ParsedUrlQueryInput);
    }
    finalData = convertToBuffer(finalData);
    /** As we try to avoid close connection on client side, so must append content-length on headers */
    if (!headers['content-length']) {
      headers['content-length'] = (finalData as Buffer).byteLength;
    }
    if (!headers['content-type']) {
      headers['content-type'] = getContentTypeByData(data);
    }
  }
  return {
    dataIsUndefined,
    dataIsReadable,
    headers,
    data: finalData,
  };
}
