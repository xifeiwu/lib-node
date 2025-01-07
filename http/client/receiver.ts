import http from 'http';
import {fromBuffer} from '../../transform';
import {getIncomingMessageData} from '../service';
import {HttpResponseInfo, GetIncomingMessageHeader} from '../../types';
import {parseHttpBody, ParseHttpResponseBodyOptions} from '../../index';

export const getHttpResponseHeaderPartInfo: GetIncomingMessageHeader<'client'> = (
  response: http.IncomingMessage
) => {
  const {httpVersion, statusCode, statusMessage, headers} = response;
  return {statusCode, statusMessage, httpVersion, headers};
};

/**
 * If dataType is provided, transform response data to dataType
 * else transform response data by response header(recommanded)
 * @param incomingMessage
 * @param options
 * @returns
 */
export async function getHttpResponseInfo<DataType = any>(
  incomingMessage: http.IncomingMessage,
  options?: ParseHttpResponseBodyOptions,
): Promise<HttpResponseInfo<DataType>> {
  const {maxLength = 64 * 1024 * 1024, dataType, parserOptions} = options ?? {};
  let data: DataType;
  if (dataType) {
    const buffer = await getIncomingMessageData(incomingMessage);
    data = fromBuffer(buffer.subarray(0, maxLength), dataType) as DataType;
  } else {
    data = await parseHttpBody<DataType>(incomingMessage, parserOptions);
  }
  return {
    ...getHttpResponseHeaderPartInfo(incomingMessage),
    data,
  };
}
