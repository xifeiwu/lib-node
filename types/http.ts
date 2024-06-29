import {IncomingHttpHeaders} from 'http';

// HTTP/1.1 200 OK
export interface HttpResponseProps<T = any> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers?: IncomingHttpHeaders;
  data?: T;
}
