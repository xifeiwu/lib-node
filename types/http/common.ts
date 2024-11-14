/**
 * Include types for both client and server
 */
import {IncomingMessage} from 'http';
import {ConnectionEnd} from '../../types';
import {HttpRequestHeaderPartProps, HttpResponseHeaderPartProps} from './tcp';

interface ConnectionEndToHeaderPart {
  client: HttpResponseHeaderPartProps<'receiver'>;
  server: HttpRequestHeaderPartProps<'receiver'>;
}
export type GetIncomingMessageHeader<End extends ConnectionEnd> = (
  incomingMessage: IncomingMessage
) => ConnectionEndToHeaderPart[End];
