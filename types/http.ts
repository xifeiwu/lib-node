import {IncomingHttpHeaders, RequestOptions} from 'http';
import {OutgoingHttpHeaders} from 'http2';
import {UrlProps} from '../external';
import {CanConvertToBuffer} from './transform';
import {Readable} from 'stream';

export type HttpRequestPayload = CanConvertToBuffer | Readable;

/**
 * A very simple request options can be used for both HttpRequest and AxiosRequest
 */
export interface GeneralRequestOptions<Payload extends HttpRequestPayload = any> extends UrlProps {
  method?: string | undefined;
  data?: Payload;
}

export type ValidateStatus = (responseInfo: HttpResponseProps) => boolean;
/**
 * A custom requestOptions based on http.RequestOptions, and used for requestAndGetResponse function.
 */
export interface HttpRequestOptions<Payload extends HttpRequestPayload = any>
  extends RequestOptions,
    GeneralRequestOptions<Payload> {}

interface HeaderTypeMap {
  Server: OutgoingHttpHeaders;
  Client: IncomingHttpHeaders;
}

/**
 * Set Client as default type of Side to make use of key words of type IncomingHttpHeaders
 */
export interface HttpResponseProps<T = any, Side extends 'Server' | 'Client' = 'Client'> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers?: HeaderTypeMap[Side];
  data?: T;
}
