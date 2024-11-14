import {ServerOpts} from 'net';

export type ConnectionEnd = 'client' | 'server';
export type ConnectionRole = 'sender' | 'receiver';

export interface TcpServerConfig {
  host?: string;
  /** support string for more compatible */
  port?: number | string;
  path?: string;
  options?: ServerOpts;
}
