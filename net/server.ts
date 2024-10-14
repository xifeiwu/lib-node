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
    httpHandler?: (socket: Socket) => void;
    tcpHandler?: (socket: Socket, firstChunk: Buffer) => void;
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

    let foundHandler = false;
    if (isHttpRequest(bufferOfFirstLine)) {
      foundHandler = Boolean(httpHandler);
      if (httpHandler) {
        httpHandler(socket);
      }
    } else {
      foundHandler = Boolean(tcpHandler);
      tcpHandler(socket, bufferOfFirstLine);
    }
  }, tcpServerConfig);
  return {host, port, server};
}
