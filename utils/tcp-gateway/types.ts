import {NetConnectOpts, Socket} from 'net';

export type Protocol = 'http' | number;

/**
 * Return false or void means there is not handler found for protocol
 * Else means the connection handled success
 */
export type TcpHandler = (
  socket: Socket,
  info: {protocol: Protocol; firstChunk: Buffer}
) => Promise<boolean | void>;

/**
 * @deprecated by TcpHandler
 */
export type HttpHandler = TcpHandler;

export interface RouteTcpConnectionOptions {
  /** a function to parse the protocol from the first chunk of the connection */
  parser?: (firstChunk: Buffer) => Protocol;
  /** a router to handle the connection by protocol */
  router?: Partial<Record<Protocol, NetConnectOpts | TcpHandler>>;
  /** a handler to handle the connection by protocol */
  tcpHandler?: TcpHandler;
}
