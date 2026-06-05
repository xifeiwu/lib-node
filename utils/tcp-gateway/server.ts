import {Socket} from 'net';
import {startSocketServer, responseHttpConnection} from './external';
import {TcpServerConfig} from '../../types';
import {Protocol, RouteTcpConnectionOptions, TcpHandler} from './types';
import {routeTcpConnection} from './service';

/**
 * TCP connection router that inspects the first bytes of each incoming connection
 * to determine the protocol, then dispatches to the appropriate handler.
 *
 * Flow:
 * 1. `onConnection` guard — runs first if provided. Returning `false` closes the socket immediately.
 * 2. Protocol detection — reads the first chunk, then uses custom `parseProtocol` or the default classifier.
 * 3. Dispatch:
 *    - `undefined` protocol → 400 response, close socket.
 *    - Protocol in `redirectByProtocol` → pipes the socket to the configured host/port.
 *    - Everything else (SOCKS, raw TCP) → delegates to `handleConnection`.
 *    - If handler returns `false` or no handler matches → 400 response, close socket.
 *
 * Priority: onConnection > parseProtocol/default detection > redirectByProtocol > handleConnection.
 *
 * @param config
 * @param tcpServerConfig
 * @returns
 */

export async function startTcpConnectionRouter(
  config: {
    onConnection?: (socket: Socket) => Promise<boolean | void>;
  } & RouteTcpConnectionOptions,
  tcpServerConfig?: TcpServerConfig
) {
  const {onConnection, ...routeConfig} = config;
  function closeSocket(socket: Socket, protocol?: Protocol) {
    if (socket.destroyed || socket.writableEnded || !socket.writable) {
      return;
    }
    responseHttpConnection(socket, {
      code: 400,
      message: `No handler found for protocol: ${protocol}`,
    });
  }

  const {host, port, server} = await startSocketServer(async socket => {
    if (onConnection && (await onConnection(socket)) === false) {
      socket.writable && socket.end(`closed by server side`);
      return;
    }
    const isHandled = await routeTcpConnection(socket, routeConfig);
    if (isHandled === false) {
      return closeSocket(socket);
    }
  }, tcpServerConfig);
  return {host, port, server};
}
