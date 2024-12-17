/**
 * Include types for both client and server
 */
import {IncomingHttpHeaders, IncomingMessage} from 'http';
import {ConnectionEnd} from '../../types';
import {HttpRequestHeaderPartInfo, HttpResponseHeaderPartInfo} from './tcp';
import {Readable} from 'stream';

interface ConnectionEndToHeaderPart {
  client: HttpResponseHeaderPartInfo<'receiver'>;
  server: HttpRequestHeaderPartInfo<'receiver'>;
}
export type GetIncomingMessageHeader<End extends ConnectionEnd> = (
  incomingMessage: IncomingMessage
) => ConnectionEndToHeaderPart[End];

/**
 * A simplified IncomingHttpHeaders that only contain properties for parse body
 */
export class ReadableWithMeta extends Readable {
  headers: IncomingHttpHeaders;
}
