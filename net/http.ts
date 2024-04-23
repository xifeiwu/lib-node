import {CanConvertToBuffer, toBuffer} from '../transform';
import {ResponseInfo} from '../types';

export function getResponseData(info: ResponseInfo) {
  let {httpVersion, statusCode, statusMessage, headers, data} = info;
  let bufferArray: CanConvertToBuffer[] = [];
  if (!/^http\//i.test(httpVersion)) {
    httpVersion = 'HTTP/' + httpVersion;
  }
  const firstLine = [httpVersion, statusCode, statusMessage].join(' ') + '\r\n';
  if (data) {
    const dataBuffer = toBuffer(data);
    headers['content-length'] = dataBuffer.byteLength + '';
    headers['connection'] = 'close';
    bufferArray.push(dataBuffer);
  }

  const headersLine = Object.entries(headers).map(([key, value]) => {
    return `${key}: ${value}` + '\r\n';
  }).join('');
  const headerStr = firstLine + headersLine + '\r\n';
  bufferArray.unshift(headerStr);
  return toBuffer(bufferArray);
}
