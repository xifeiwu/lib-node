import {OutgoingHttpHeaders, IncomingHttpHeaders} from 'http';

export interface TcpHttpFirstLineProps {
  method: string;
  url: string;
  httpVersion: string;
}

export interface TcpHttpHeaderPartProps extends TcpHttpFirstLineProps {
  headers?: IncomingHttpHeaders;
}
// GET /api/test/echo HTTP/1.1
export interface TcpHttpRequestProps<T = any> extends TcpHttpHeaderPartProps {
  // method: string;
  // url: string;
  // httpVersion: string;
  data?: T;
}
// HTTP/1.1 200 OK
export interface TcpHttpResponseProps<T = any> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers?: IncomingHttpHeaders;
  data?: T;
}
