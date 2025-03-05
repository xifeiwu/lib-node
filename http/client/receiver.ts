import http from 'http';
import {HttpResponseInfo, GetIncomingMessageHeader} from '../../types';
import {HttpBodyParserOptions, parseHttpBody} from '../../lib/http-body-parser';

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
  bodyParserOptions?: HttpBodyParserOptions
): Promise<HttpResponseInfo<DataType>> {
  const data = await parseHttpBody<DataType>(incomingMessage, bodyParserOptions);
  const result = {
    ...getHttpResponseHeaderPartInfo(incomingMessage),
    data,
  };
  return result;
}
