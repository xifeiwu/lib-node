import {IncomingHttpHeaders} from 'http';
import {OutgoingHttpHeaders} from 'http2';

interface HeaderTypeMap {
  Server: OutgoingHttpHeaders;
  Client: IncomingHttpHeaders;
}
export interface HttpResponseProps<T = any, Side extends 'Server' | 'Client' = 'Client'> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers?: HeaderTypeMap[Side];
  data?: T;
}
