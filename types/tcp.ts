import {IncomingHttpHeaders, OutgoingHttpHeaders} from 'http';
import {ServerOpts} from 'net';

export interface TcpServerConfig {
  host?: string;
  port?: number;
  path?: string;
  options?: ServerOpts;
}
// GET /api/test/echo HTTP/1.1
export interface HttpFirstLineProps {
  method: string;
  url: string;
  httpVersion: string;
}

export interface RequestSideToHeaderType {
  Server: IncomingHttpHeaders;
  Client: OutgoingHttpHeaders;
}

export interface HttpHeaderPartProps<Side extends 'Server' | 'Client' = 'Client'> extends HttpFirstLineProps {
  headers?: RequestSideToHeaderType[Side];
}

export interface TcpHttpRequestProps<T = any, Side extends 'Server' | 'Client' = 'Client'>
  extends HttpHeaderPartProps<Side> {
  data?: T;
}

export type TcpRequestProps = Omit<TcpHttpRequestProps, 'method' | 'url' | 'httpVersion' | 'headers'> &
  Partial<Pick<TcpHttpRequestProps, 'method' | 'url' | 'httpVersion' | 'headers'>>;
