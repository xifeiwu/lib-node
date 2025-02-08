import {ServerOptions} from 'http';
import {HttpResponseInfo} from '../../types';
import {PlainObject} from '../external';

export interface HttpServerConfig {
  host?: string;
  port?: number;
  options?: ServerOptions;
}

/**
 * Custom how to handle response on server side
 */
export interface CustomResponseOptions extends Partial<HttpResponseInfo<PlainObject, 'receiver'>> {
  delayMs?: number | string;
}

/**
 * @deprecated by CustomResponseOptions
 */
export type CustomHandleRequestOptions = CustomResponseOptions;
