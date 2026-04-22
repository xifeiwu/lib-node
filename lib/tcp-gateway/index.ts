import {Socket} from 'net';
import {
  startSocketClient,
  startSocketServer,
  getOneLineFromReader,
  responseHttpConnection,
  isSocksProtocol,
  SocksVersion,
  REG_HTTP_REQUEST_FIRST_LINE,
} from './external';
import {HttpHandler, Protocol, TcpHandler, TcpServerConfig} from '../../types';

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return REG_HTTP_REQUEST_FIRST_LINE.test(str);
}

async function getConnectionProtocol(
  socket: Socket
): Promise<{protocol?: Protocol | undefined; firstChunk: Buffer}> {
  const firstChunk = await getOneLineFromReader(socket, {firstChunkOnly: true});
  socket.unshift(firstChunk);
  const result: {protocol?: Protocol | undefined; firstChunk: Buffer} = {firstChunk};
  if (firstChunk.byteLength === 0) {
    return result;
  }
  if (isHttpRequest(firstChunk)) {
    result.protocol = 'http';
  } else {
    const firstByte = firstChunk[0];
    if (isSocksProtocol(firstByte)) {
      result.protocol = firstByte as SocksVersion;
    }
  }
  return result;
}

/**
 * TCP connection router that inspects the first bytes of each incoming connection
 * to determine the protocol, then dispatches to the appropriate handler.
 *
 * Flow:
 * 1. `onConnection` guard — runs first if provided. Returning `false` closes the socket immediately.
 * 2. Protocol detection — reads the first chunk and classifies as `'http'`, SOCKS version, or `undefined`.
 * 3. Dispatch:
 *    - `undefined` protocol → 400 response, close socket.
 *    - HTTP → tries `httpHandler` first; falls back to piping to `httpServerInfo` as a reverse proxy.
 *    - Everything else (SOCKS, raw TCP) → delegates to `tcpHandler`.
 *    - If handler returns `false` or no handler matches → 400 response, close socket.
 *
 * Priority: onConnection > protocol detection > httpHandler > httpServerInfo > tcpHandler.
 *
 * @param config
 * @param tcpServerConfig
 * @returns
 */
export async function startTcpGateway(
  config: {
    onConnection?: (socket: Socket) => Promise<boolean | void>;
    /**
     * return false means connection is not handled
     * else return undefined or true means it's handled by httpHander or tcpHandler
     * httpHandler has high priority than httpServerInfo, as caller can do more customized action,
     */
    httpHandler?: HttpHandler;
    httpServerInfo?: {
      host: string;
      port: number;
    };
    tcpHandler?: TcpHandler;
  },
  tcpServerConfig?: TcpServerConfig
) {
  const {onConnection, httpHandler, httpServerInfo, tcpHandler} = config;
  function closeSocket(socket: Socket, protocol?: Protocol) {
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
    const {protocol, firstChunk} = await getConnectionProtocol(socket);
    if (protocol === undefined) {
      return closeSocket(socket);
    }
    let isHandled: boolean | void = false;
    if (protocol === 'http' && (httpHandler || httpServerInfo)) {
      if (httpHandler) {
        isHandled = await httpHandler(socket, {firstChunk});
      } else {
        const proxySocket = await startSocketClient(httpServerInfo);
        socket.pipe(proxySocket).pipe(socket);
        isHandled = true;
      }
    } else if (tcpHandler) {
      isHandled = await tcpHandler(socket, {protocol, firstChunk});
    }
    if (isHandled === false) {
      return closeSocket(socket);
    }
  }, tcpServerConfig);
  return {host, port, server};
}
