import {Socket, TcpNetConnectOpts, SocketReadyState} from 'net';
import {CanConvertToBuffer} from './transform';

export type GetSocketOptions = TcpNetConnectOpts | Socket;

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
