import {Socket} from 'net';

export type Protocol = 'http' | number;

/**
 * Return false or void means there is not handler found for protocol
 * Else means the connection handled success
 */
export type TcpHandler = (
  socket: Socket,
  info: {protocol: Protocol; firstChunk: Buffer}
) => Promise<boolean | void>;
export type HttpHandler = (socket: Socket, info: {firstChunk}) => Promise<boolean | void>;
