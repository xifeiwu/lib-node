import {Socket} from 'net';
import {startSocketClient, startSocketServer} from '../net';
import {getOneLineFromReader} from '../stream';
import {httpFirstLineReg} from '../service';
import {HttpHandler, Protocol, TcpHandler, TcpServerConfig} from '../types';
import {isSocksProtocol, SocksVersion} from '../lib/socks';
import {responseHttpConnection} from '../http';

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return httpFirstLineReg.test(str);
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
 * Redirect to different handler by first line of incoming socket
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
    let isHandled;
    if (protocol === 'http' && (httpHandler || httpServerInfo)) {
      if (httpHandler) {
        isHandled = httpHandler(socket, {firstChunk});
      } else {
        const proxySocket = await startSocketClient(httpServerInfo);
        socket.pipe(proxySocket).pipe(socket);
        isHandled = true;
      }
    } else {
      // foundHandler = Boolean(tcpHandler);
      isHandled = tcpHandler && (await tcpHandler(socket, {protocol, firstChunk}));
    }
    if (isHandled === false) {
      return closeSocket(socket);
    }
  }, tcpServerConfig);
  return {host, port, server};
}
