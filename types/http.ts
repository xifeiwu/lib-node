import {IncomingHttpHeaders} from 'http';

export interface HttpFirstLineInfo {
  method: string;
  url: string;
  httpVersion: string;
}

export interface HttpHeaderPartInfo extends HttpFirstLineInfo {
  headers?: IncomingHttpHeaders;
}
// GET /api/test/echo HTTP/1.1
export interface HttpRequestInfo<T = any> extends HttpHeaderPartInfo {
  // method: string;
  // url: string;
  // httpVersion: string;
  data?: T;
}
// HTTP/1.1 200 OK
export interface HttpResponseInfo<T = any> {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
  headers?: IncomingHttpHeaders;
  data?: T;
}
