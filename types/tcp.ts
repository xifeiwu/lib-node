import {IncomingHttpHeaders, OutgoingHttpHeaders} from 'http';

// GET /api/test/echo HTTP/1.1
export interface HttpFirstLineProps {
  method: string;
  url: string;
  httpVersion: string;
}

interface HeaderTypeMap {
  Server: IncomingHttpHeaders;
  Client: OutgoingHttpHeaders;
}

export interface HttpHeaderPartProps<Side extends 'Server' | 'Client' = 'Client'>
  extends HttpFirstLineProps {
  headers?: HeaderTypeMap[Side];
}

export interface TcpHttpRequestProps<T = any, Side extends 'Server' | 'Client' = 'Client'>
  extends HttpHeaderPartProps<Side> {
  data?: T;
}
