import {Socket, TcpNetConnectOpts, SocketReadyState, Server} from 'net';
import {CanConvertToBuffer} from './transform';
import {HttpUpgradeConfig} from './http';
import net, {ServerOpts} from 'net';
import {Readable} from 'stream';
import tls, {TlsOptions} from 'tls';

export type GetSocketOptions = TcpNetConnectOpts | HttpUpgradeConfig | Socket;

export interface SocketInfo {
  id: string;
  allowHalfOpen: boolean;
  readable: boolean;
  readableFlowing: boolean;
  bytesRead: number;
  writable: boolean;
  bytesWritten: number;
  destroyed: boolean;
  readyState: SocketReadyState;
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
}

export type OneChatHandler = (data: Buffer) => Promise<CanConvertToBuffer>;

export type ConnectionEnd = 'client' | 'server';
export type ConnectionRole = 'sender' | 'receiver';
export type ConnectionPayload = CanConvertToBuffer | Readable;

interface TcpServerConfigCommon {
  host?: string;
  /** support string for more compatible */
  port?: number | string;
  path?: string;
  /** disconnect the socket after this many ms of inactivity; omit to keep the connection open */
  idleTimeoutMs?: number;
}
export interface NetServerConfig extends TcpServerConfigCommon {
  options?: ServerOpts;
}
export interface TlsServerConfig extends TcpServerConfigCommon {
  options?: TlsOptions;
}
export type TcpServerConfig = NetServerConfig | TlsServerConfig;

interface NetServerInfoCommon {
  host: string;
  port: number;
  path: string;
  overTls: boolean;
}
export interface NetServerInfo extends NetServerInfoCommon {
  server: net.Server;
}
export interface TlsServerInfo extends NetServerInfoCommon {
  server: tls.Server;
}
export type TcpServerInfo = NetServerInfo | TlsServerInfo;

/**
 * @deprecated TcpServerInfo
 */
export type SocketServerInfo = TcpServerInfo;
