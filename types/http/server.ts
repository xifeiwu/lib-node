import {ServerOptions} from 'http';
import {HttpResponseInfo} from '../..';

export interface HttpServerConfig {
  host?: string;
  port?: number;
  options?: ServerOptions;
}

/**
 * How to handle IncomingMessage fro server side
 * There is no object values to make sure params can be passed by querystring
 */
export interface CustomResponseOptions<DataType = any> extends HttpResponseInfo<DataType, 'receiver'> {
  delayMs?: number | string;
}

/**
 * @deprecated by CustomResponseOptions
 */
export type CustomHandleRequestOptions = CustomResponseOptions;
