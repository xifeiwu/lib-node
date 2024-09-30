import {Socket, TcpNetConnectOpts, SocketReadyState, Server} from 'net';
import {CanConvertToBuffer} from './transform';
import {HttpUpgradeConfig} from './http';

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
