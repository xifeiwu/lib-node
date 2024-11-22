import {IncomingHttpHeaders, OutgoingHttpHeaders, RequestOptions} from 'http';
import {UrlProps} from '../../external';
import {HttpResponseInfo} from './tcp';
import {ConnectionPayload} from '../net';

/**
 * @deprecated by ConnectionPayload
 */
export type HttpRequestPayload = ConnectionPayload;

export type HttpReceiverResponseInfo<DataType = any> = HttpResponseInfo<DataType, 'receiver'>;
/**
 * A very simple request options can be used for both HttpRequest and AxiosRequest
 */
export interface GeneralRequestOptions<Payload extends ConnectionPayload = any> extends UrlProps {
  method?: string | undefined;
  data?: Payload;
}

export type ValidateStatus = (responseInfo: HttpReceiverResponseInfo) => boolean;
/**
 * A custom requestOptions based on http.RequestOptions, and used for requestAndGetResponse function.
 */
export interface HttpRequestOptions<Payload extends ConnectionPayload = any>
  extends RequestOptions,
    GeneralRequestOptions<Payload> {}

export interface ResponseSideToHeaderType {
  Server: OutgoingHttpHeaders;
  Client: IncomingHttpHeaders;
}

/**
 * The least props used to upgrade to other protocol based on http protocol
 */
export interface HttpUpgradeConfig {
  href: HttpRequestOptions['href'];
  upgrade: HttpRequestOptions['headers']['upgrade'];
}
