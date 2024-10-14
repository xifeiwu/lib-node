import {ServerOpts, Socket} from 'net';
import {startSocketServer} from '../net';
import {getOneLineFromReader} from '../stream';
import {httpFirstLineReg} from '../constants';
import {TcpServerConfig} from '../types';

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return httpFirstLineReg.test(str);
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
    httpHandler?: (socket: Socket) => Promise<boolean | void>;
    tcpHandler?: (socket: Socket, firstChunk: Buffer) => Promise<boolean | void>;
  },
  tcpServerConfig?: TcpServerConfig
) {
  const {onConnection, httpHandler, tcpHandler} = config;

  const {host, port, server} = await startSocketServer(async socket => {
    if (onConnection && (await onConnection(socket)) === false) {
      socket.writable && socket.end(`closed by server side`);
      return;
    }
    const bufferOfFirstLine = await getOneLineFromReader(socket, {firstChunkOnly: true});
    socket.unshift(bufferOfFirstLine);

    // let foundHandler = false;
    let isHandled;
    if (isHttpRequest(bufferOfFirstLine)) {
      isHandled = httpHandler && (await httpHandler(socket));
    } else {
      // foundHandler = Boolean(tcpHandler);
      isHandled = tcpHandler && (await tcpHandler(socket, bufferOfFirstLine));
    }
    if (isHandled === false) {
      socket.writable && socket.end('not handle');
    }
  }, tcpServerConfig);
  return {host, port, server};
}
