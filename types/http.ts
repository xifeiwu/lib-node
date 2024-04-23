import {IncomingHttpHeaders} from 'http';

export interface HttpFirstLineInfo {
  method: string;
  url: string;
  httpVersion: string;
}

// GET /api/test/echo HTTP/1.1
export interface RequestInfo<T = any> extends HttpFirstLineInfo {
  // method: string;
  // url: string;
  // httpVersion: string;
  headers: IncomingHttpHeaders;
  data?: T;
}
// HTTP/1.1 200 OK
export interface ResponseInfo<T = any> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers: IncomingHttpHeaders;
  data?: T;
}
