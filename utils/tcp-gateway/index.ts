import {Socket} from 'net';
import {
  startSocketClient,
  startSocketServer,
  getOneLineFromReader,
  responseHttpConnection,
  REG_HTTP_REQUEST_FIRST_LINE,
} from './external';
import {TcpServerConfig} from '../../types';
import {Protocol, TcpHandler} from './types';

export {Protocol, TcpHandler, HttpHandler} from './types';

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return REG_HTTP_REQUEST_FIRST_LINE.test(str);
}

async function getConnectionProtocol(
  socket: Socket,
  parseProtocol?: (firstChunk: Buffer) => Protocol
): Promise<{protocol?: Protocol | undefined; firstChunk: Buffer}> {
  const firstChunk = await getOneLineFromReader(socket, {firstChunkOnly: true});
  socket.unshift(firstChunk);
  const result: {protocol?: Protocol | undefined; firstChunk: Buffer} = {firstChunk};
  if (firstChunk.byteLength === 0) {
    return result;
  }
  const parsedProtocol = parseProtocol?.(firstChunk);
  if (parsedProtocol !== undefined) {
    result.protocol = parsedProtocol;
  } else if (isHttpRequest(firstChunk)) {
    result.protocol = 'http';
  } else {
    result.protocol = firstChunk[0];
  }
  return result;
}

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
export async function startTcpGateway(
  config: {
    onConnection?: (socket: Socket) => Promise<boolean | void>;
    parseProtocol?: (firstChunk: Buffer) => Protocol;
    redirectByProtocol?: Partial<Record<Protocol, {host: string; port: number}>>;
    handleConnection?: TcpHandler;
  },
  tcpServerConfig?: TcpServerConfig
) {
  const {onConnection, parseProtocol, redirectByProtocol, handleConnection} = config;
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
    const {protocol, firstChunk} = await getConnectionProtocol(socket, parseProtocol);
    let isHandled: boolean | void = false;
    /** if client not send data, or client closed connection, stop here */
    if (protocol === undefined) {
      return closeSocket(socket);
    }
    const redirectInfo = redirectByProtocol?.[protocol];
    if (redirectInfo) {
      const proxySocket = await startSocketClient(redirectInfo);
      socket.pipe(proxySocket).pipe(socket);
      isHandled = true;
    } else if (handleConnection) {
      isHandled = await handleConnection(socket, {protocol, firstChunk});
    }
    if (isHandled === false) {
      return closeSocket(socket);
    }
  }, tcpServerConfig);
  return {host, port, server};
}
