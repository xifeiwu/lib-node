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
export interface HttpRequestFirstLineProps {
  method: string;
  url: string;
  httpVersion: string;
}

export interface HttpRequestHeaderPartProps<Role extends ConnectionRole = 'sender'>
  extends HttpRequestFirstLineProps {
  headers?: ConnectionRoleToHeaderType[Role];
}

export interface HttpRequestProps<DataType = any, Role extends ConnectionRole = 'sender'>
  extends HttpRequestHeaderPartProps<Role> {
  data?: DataType;
}

export interface HttpResponseFirstLineProps {
  httpVersion: string;
  statusCode: number;
  statusMessage: string;
}

export interface HttpResponseHeaderPartProps<Role extends ConnectionRole = 'receiver'>
  extends HttpResponseFirstLineProps {
  headers?: ConnectionRoleToHeaderType[Role];
}

export interface HttpResponseProps<DataType = any, Role extends ConnectionRole = 'receiver'>
  extends HttpResponseHeaderPartProps<Role> {
  data?: DataType;
}

export type TcpHttpRequestOptions = Omit<HttpRequestProps, 'method' | 'url' | 'httpVersion' | 'headers'> &
  Partial<Pick<HttpRequestProps, 'method' | 'url' | 'httpVersion' | 'headers'>>;
