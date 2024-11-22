import {Socket, TcpNetConnectOpts, SocketReadyState, Server} from 'net';
import {CanConvertToBuffer} from './transform';
import {HttpUpgradeConfig} from './http';
import {SocksVersion} from './socks';
import {ServerOpts} from 'net';
import {Readable} from 'stream';

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

export interface SocketServerInfo {
  host: string;
  port: number;
  path: string;
  server: Server;
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

export interface TcpServerConfig {
  host?: string;
  /** support string for more compatible */
  port?: number | string;
  path?: string;
  options?: ServerOpts;
}
