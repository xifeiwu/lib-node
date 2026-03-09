import querystring, {ParsedUrlQueryInput} from 'querystring';
import {isReadable, Readable} from 'stream';
import {convertKeyToLowerCase, isObject, isPlainObject} from '../../../../external';
import {ReadableWithMeta, CanConvertToBuffer, HttpCommonInfo} from '../../../../types';
import {OutgoingHttpHeaders} from 'http';

/**
 * if 'content-type': 'application/x-www-form-urlencoded',
 * we can use this function to convert json data to urlencoded format
 */
export function toUrlencodedFormat(data: object) {
  if (isObject(data)) {
    return querystring.stringify(data as ParsedUrlQueryInput);
  }
  return data;
}

export async function getIncomingMessageData(incomingMessage: ReadableWithMeta) {
  const {headers} = incomingMessage;
  let contentLength: number;
  if ('chunked' !== headers['transfer-encoding']?.toLocaleLowerCase()) {
    contentLength = parseInt(headers['content-length']);
  }
  let resolved = false;
  return new Promise<Buffer | undefined>((res, rej) => {
    let byteLength = 0;
    const bufferList: Buffer[] = [];
    incomingMessage.on('data', (chunk: Buffer) => {
      if (resolved) {
        return;
      }
      bufferList.push(chunk);
      byteLength += chunk.byteLength;
      /** This logic is a bit redundant, nodejs http module can handle it well and trigger end event at correct moment */
      if (!Number.isNaN(contentLength) && byteLength >= contentLength) {
        resolved = true;
        res(Buffer.concat(bufferList).subarray(0, contentLength));
      }
    });
    incomingMessage.on('end', () => {
      if (resolved) {
        return;
      }
      if (bufferList.length > 0) {
        res(Buffer.concat(bufferList));
      } else {
        res(undefined);
      }
    });
    incomingMessage.on('error', (err: any) => {
      rej(err);
    });
  });
}

export function inferContentTypeByData(data: CanConvertToBuffer | Readable) {
  if (isPlainObject(data) || Array.isArray(data)) {
    return 'application/json;charset=UTF-8';
  } else if (Buffer.isBuffer(data)) {
    return 'application/octet-stream';
  } else {
    return 'text/plain';
  }
}

export function parseContentType(contentType?: string) {
  if (!contentType) {
    return {};
  }
  const [type, ...rest] = contentType.split(/; ?/).map(it => it.trim());
  // charset, boundary
  const props = rest.reduce<object>((sum, str) => {
    const index = str.indexOf('=');
    if (index > 0) {
      const key = str.substring(0, index);
      const value = str.substring(index + 1);
      return {
        ...sum,
        [key]: value,
      };
    } else {
      return sum;
    }
  }, {});
  // return [type];
  return {
    type,
    props,
  };
}

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
