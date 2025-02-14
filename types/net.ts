import {Socket, TcpNetConnectOpts, SocketReadyState, Server} from 'net';
import {CanConvertToBuffer} from './transform';
import {HttpUpgradeConfig} from './http';
import {SocksVersion} from './socks';
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

export type Protocol = 'http' | SocksVersion;

/**
 * Return false means there is not handler found for protocol
 * Else means the connection handled success
 */
export type TcpHandler = (
  socket: Socket,
  info: {protocol: Protocol; firstChunk: Buffer}
) => Promise<boolean | void>;
export type HttpHandler = (socket: Socket, info: {firstChunk}) => Promise<boolean | void>;

export type ConnectionEnd = 'client' | 'server';
export type ConnectionRole = 'sender' | 'receiver';
export type ConnectionPayload = CanConvertToBuffer | Readable;

interface TcpServerConfigCommon {
  host?: string;
  /** support string for more compatible */
  port?: number | string;
  path?: string;
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
