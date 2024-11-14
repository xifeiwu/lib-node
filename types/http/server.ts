import {ServerOptions} from 'http';

export interface HttpServerConfig {
  host?: string;
  port?: number;
  options?: ServerOptions;
}

/**
 * How to handle IncomingMessage fro server side
 * There is no object values to make sure params can be passed by querystring
 */
export interface CustomHandleRequestOptions {
  delayMs?: number | string;
  responseCode?: number | string;
}