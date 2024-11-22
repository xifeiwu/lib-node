import http from 'http';
import {fromBuffer} from '../../transform';
import {getIncomingMessageData} from '../service';
import {HttpResponseInfo, GetIncomingMessageHeader} from '../../types';

export const getHttpResponseHeaderPartInfo: GetIncomingMessageHeader<'client'> = (
  response: http.IncomingMessage
) => {
  const {httpVersion, statusCode, statusMessage, headers} = response;
  return {statusCode, statusMessage, httpVersion, headers};
};

export async function getHttpResponseInfo<DataType = any>(
  incomingMessage: http.IncomingMessage,
  options?: {
    maxLength?: number;
    dataType?: 'buffer' | 'string' | 'json';
  }
): Promise<HttpResponseInfo<DataType>> {
  const {maxLength = 32 * 1024 * 1024, dataType = 'json'} = options ?? {};
  let buffer = await getIncomingMessageData(incomingMessage);
  if (buffer.byteLength > maxLength) {
    buffer = buffer.subarray(0, maxLength);
  }
  const data = fromBuffer(buffer, dataType) as DataType;
  return {
    ...getHttpResponseHeaderPartInfo(incomingMessage),
    data,
  };
}
