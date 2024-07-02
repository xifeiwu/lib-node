import {IncomingHttpHeaders} from 'http';
import {OutgoingHttpHeaders} from 'http2';

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
