import {IncomingHttpHeaders, OutgoingHttpHeaders, RequestOptions} from 'http';
import {UrlProps} from '../../external';
import {CanConvertToBuffer} from '../transform';
import {Readable} from 'stream';
import { HttpResponseProps } from './tcp';

export type HttpRequestPayload = CanConvertToBuffer | Readable;
export type HttpResponseInfo<DataType = any> = HttpResponseProps<DataType, 'receiver'>
/**
 * A very simple request options can be used for both HttpRequest and AxiosRequest
 */
export interface GeneralRequestOptions<Payload extends HttpRequestPayload = any> extends UrlProps {
  method?: string | undefined;
  data?: Payload;
}

export type ValidateStatus = (responseInfo: HttpResponseInfo) => boolean;
/**
 * A custom requestOptions based on http.RequestOptions, and used for requestAndGetResponse function.
 */
export interface HttpRequestOptions<Payload extends HttpRequestPayload = any>
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
