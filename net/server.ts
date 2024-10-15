import {Socket} from 'net';
import {startSocketClient, startSocketServer} from '../net';
import {getOneLineFromReader} from '../stream';
import {httpFirstLineReg} from '../constants';
import {Protocol, TcpHandler, TcpServerConfig} from '../types';
import {isSocksProtocol, SocksVersion} from '../lib/socks';

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
export async function startTcpProxyServer(
  config: {
    onConnection?: (socket: Socket) => Promise<boolean | void>;
    /**
     * return false means connection is not handled
     * else return undefined or true means it's handled by httpHander or tcpHandler
     */
    // httpHandler?: (socket: Socket, info: {firstChunk}) => Promise<boolean | void>;
    httpServerInfo?: {
      host: string;
      port: number;
    };
    tcpHandler?: TcpHandler;
  },
  tcpServerConfig?: TcpServerConfig
) {
  const {onConnection, httpServerInfo, tcpHandler} = config;
  function closeSocket(socket: Socket, protocol?: Protocol) {
    const message = protocol !== undefined ? `Not handle protocol: ${protocol}` : `Protocol is unknown`;
    socket.writable && socket.end(message);
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
    if (protocol === 'http' && httpServerInfo) {
      const proxySocket = await startSocketClient(httpServerInfo);
      socket.pipe(proxySocket).pipe(socket);
      isHandled = true;
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
