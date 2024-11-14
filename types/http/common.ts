/**
 * Include types for both client and server
 */
import {IncomingMessage} from 'http';
import {ConnectionEnd} from '../../types';
import {HttpRequestHeaderPartInfo, HttpResponseHeaderPartInfo} from './tcp';

interface ConnectionEndToHeaderPart {
  client: HttpResponseHeaderPartInfo<'receiver'>;
  server: HttpRequestHeaderPartInfo<'receiver'>;
}
export type GetIncomingMessageHeader<End extends ConnectionEnd> = (
  incomingMessage: IncomingMessage
) => ConnectionEndToHeaderPart[End];
