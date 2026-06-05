import {NetConnectOpts, Socket} from 'net';
import {getOneLineFromReader, REG_HTTP_REQUEST_FIRST_LINE, pipeSocketToTarget} from './external';
import {Protocol, RouteTcpConnectionOptions, TcpHandler} from './types';

export {Protocol, TcpHandler, HttpHandler} from './types';

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return REG_HTTP_REQUEST_FIRST_LINE.test(str);
}

/**
 * Get the protocol and the first chunk of the connection
 * @param socket the socket of the connection
 * @param parser a function to parse the protocol from the first chunk of the connection
 * @returns {protocol?: Protocol | undefined; firstChunk: Buffer} the protocol and the first chunk
 * Mainly focus on parse protocol, if your route depends on more first chunk info, you can do deeper analysis outside.
 * like use using tryParseHttpRequestFirstLine for parse http method, url, http version, etc. for next level router.
 * 1. if parseProtocol is provided, use it to parse the protocol, it has higher priority
 * 2. if the first chunk is a valid http request, set the protocol to 'http'
 * 3. otherwise, set the protocol to the first byte of the first chunk(mainly used for socks5, may change later, or support more protocols)
 */
export async function parseProtocolFromFirstChunk(
  socket: Socket,
  options?: {
    parser?: RouteTcpConnectionOptions['parser'];
    /** max time to wait for the first chunk */
    timeout?: number;
  }
): Promise<{protocol?: Protocol | undefined; firstChunk: Buffer}> {
  const {parser, timeout} = options ?? {};
  const firstChunk = await getOneLineFromReader(socket, {firstChunkOnly: true, timeout});
  /** put the first chunk back to the socket, to make sure socket contains raw data */
  socket.unshift(firstChunk);
  const result: {protocol?: Protocol | undefined; firstChunk: Buffer} = {firstChunk};
  if (firstChunk.byteLength === 0) {
    return result;
  }
  const parsedProtocol = parser?.(firstChunk);
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
 * route the tcp connection to the appropriate handler
 * @param socket
 * @param config
 * @returns true if the connection is handled, false otherwise
 */
export async function routeTcpConnection(socket: Socket, config: RouteTcpConnectionOptions) {
  const {parser, router, tcpHandler} = config;
  const {protocol, firstChunk} = await parseProtocolFromFirstChunk(socket, {parser});
  let isHandled: boolean | void = false;
  const protocolHandler = router?.[protocol];
  if (protocolHandler) {
    if (typeof protocolHandler === 'object') {
      await pipeSocketToTarget(socket, protocolHandler);
      isHandled = true;
    } else {
      isHandled = await protocolHandler(socket, {protocol, firstChunk});
    }
  } else if (tcpHandler) {
    isHandled = await tcpHandler(socket, {protocol, firstChunk});
  }
  return isHandled;
}
