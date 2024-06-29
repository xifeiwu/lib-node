import {OutgoingHttpHeaders} from 'http';

// GET /api/test/echo HTTP/1.1
export interface HttpFirstLineProps {
  method: string;
  url: string;
  httpVersion: string;
}

export interface HttpOutgoingHeaderPartProps extends HttpFirstLineProps {
  headers?: OutgoingHttpHeaders;
}

export interface TcpHttpRequestProps<T = any> extends HttpOutgoingHeaderPartProps {
  data?: T;
}
