/**
 * Http related interface on tcp level
 */
import {IncomingHttpHeaders, OutgoingHttpHeaders} from 'http';
import {ConnectionRole} from '../tcp';

interface ConnectionRoleToHeaderType {
  sender: OutgoingHttpHeaders;
  receiver: IncomingHttpHeaders;
}

// GET /api/test/echo HTTP/1.1
export interface HttpRequestFirstLineInfo {
  method: string;
  url: string;
  httpVersion: string;
}

export interface HttpRequestHeaderPartInfo<Role extends ConnectionRole = 'sender'>
  extends HttpRequestFirstLineInfo {
  headers?: ConnectionRoleToHeaderType[Role];
}

export interface HttpRequestInfo<DataType = any, Role extends ConnectionRole = 'sender'>
  extends HttpRequestHeaderPartInfo<Role> {
  data?: DataType;
}

export interface HttpResponseFirstLineInfo {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
}

export interface HttpResponseHeaderPartInfo<Role extends ConnectionRole = 'receiver'>
  extends HttpResponseFirstLineInfo {
  headers?: ConnectionRoleToHeaderType[Role];
}

export interface HttpResponseInfo<DataType = any, Role extends ConnectionRole = 'receiver'>
  extends HttpResponseHeaderPartInfo<Role> {
  data?: DataType;
}

/**
 * @deprecated by HttpRequestInfo
 */
export type TcpHttpRequestOptions = Omit<HttpRequestInfo, 'method' | 'url' | 'httpVersion' | 'headers'> &
  Partial<Pick<HttpRequestInfo, 'method' | 'url' | 'httpVersion' | 'headers'>>;
