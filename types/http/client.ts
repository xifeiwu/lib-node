import {ClientRequest, IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, RequestOptions} from 'http';
import {UrlProps} from '../../external';
import {HttpResponseInfo} from './tcp';
import {ConnectionPayload} from '../net';
import {HttpBodyParserOptions} from '../../lib/http-body-parser';

/**
 * @deprecated by ConnectionPayload
 */
export type HttpRequestPayload = ConnectionPayload;

/**
 * A very simple request options can be used for both HttpRequest and AxiosRequest
 */
export interface GeneralRequestOptions<Payload extends ConnectionPayload = any> extends UrlProps {
  method?: string | undefined;
  data?: Payload;
}

/**
 * A custom requestOptions based on http.RequestOptions, and used for requestAndGetResponse function.
 */
export interface HttpRequestOptions<Payload extends ConnectionPayload = any>
  extends RequestOptions, GeneralRequestOptions<Payload> {}

export type HttpReceiverResponseInfo<DataType = any> = HttpResponseInfo<DataType, 'receiver'>;

export type ValidateStatus = (responseInfo: HttpReceiverResponseInfo) => boolean;
// export interface ResponseSideToHeaderType {
//   Server: OutgoingHttpHeaders;
//   Client: IncomingHttpHeaders;
// }

export interface ParseHttpResponseOptions {
  validateStatus?: ValidateStatus | boolean;
  /** Only works when validateStatus is set, or can't aware which condition is error condition */
  printCurlCommandOnError?: boolean;
  bodyParserOptions?: HttpBodyParserOptions;
}

export interface SendHttpRequestResult {
  request: ClientRequest;
  url: URL;
  requestOptions: HttpRequestOptions;
}
export interface SendRequestWithResponseResult extends SendHttpRequestResult {
  response: IncomingMessage;
}
export interface SendRequestWithResponseInfoResult<ResData = any> extends SendRequestWithResponseResult {
  responseInfo: HttpResponseInfo<ResData>;
}

/**
 * The least props used to upgrade to other protocol based on http protocol
 */
export interface HttpUpgradeConfig {
  href: HttpRequestOptions['href'];
  upgrade: HttpRequestOptions['headers']['upgrade'];
}
