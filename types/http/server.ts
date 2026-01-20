import https from 'https';
import http from 'http';
import {HttpResponseInfo} from '../../types';
import {PlainObject} from '../../external';

export interface HttpServerConfig {
  host?: string;
  port?: number;
  /**
   * @deprecated https.ServerOptions in this type
   */
  options?: http.ServerOptions | https.ServerOptions;
}
export interface HttpsServerConfig {
  host?: string;
  port?: number;
  options?: https.ServerOptions;
}
/**
 * Custom how to handle response on server side
 */
export interface CustomizeResponseOptions extends Partial<HttpResponseInfo<PlainObject, 'receiver'>> {
  delayMs?: number | string;
}

/**
 * @deprecated by CustomResponseOptions
 */
export type CustomHandleRequestOptions = CustomizeResponseOptions;
