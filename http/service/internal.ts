import {isReadable, Readable} from 'stream';
import querystring, {ParsedUrlQueryInput} from 'querystring';
import {ConnectionPayload, HttpCommonInfo} from '../../types';
import {isObject, convertKeyToLowerCase} from '../../external';
import {convertToBuffer} from '../../transform';
import {getContentTypeByData} from './common';

export function toFormUrlencoded(data: object) {
  if (isObject(data)) {
    return querystring.stringify(data as ParsedUrlQueryInput);
  }
  return data;
}

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
