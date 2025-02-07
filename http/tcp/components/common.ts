import {inferContentTypeByData, toBuffer} from '../../../index';
import {HttpResponseInfo} from '../../../types';

export function responseInfoToBuffer(responseInfo: Partial<HttpResponseInfo>) {
  const {httpVersion = 'HTTP/1.1', statusCode = 200, statusMessage = 'OK', headers = {}, data} = responseInfo;
  const firstLine = [httpVersion, statusCode, statusMessage].join(' ').toUpperCase();
  const bufferOfData = toBuffer(data);
  headers['content-type'] = inferContentTypeByData(data);
  if (bufferOfData.byteLength > 0) {
    headers['content-length'] = bufferOfData.byteLength + '';
  } else {
    headers['content-length'] = 0 + '';
  }
  const headerLines = Object.entries(headers).map(([key, value]) => {
    return key + ': ' + value;
  });
  const headerPart = [firstLine, ...headerLines].join('\r\n') + '\r\n\r\n';
  return toBuffer([headerPart, data]);
}
