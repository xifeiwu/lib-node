import {ServerOpts, Socket} from 'net';
import {startSocketServer} from '../net';
import {getOneLineFromReader} from '../stream';
import {httpFirstLineReg} from '../constants';

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return httpFirstLineReg.test(str);
}

export async function startSyntheticServer(
  config: {
    onConnection?: (socket: Socket) => Promise<boolean | void>;
    httpHandler?: (socket: Socket) => void;
    tcpHandler?: (socket: Socket, firstChunk: Buffer) => void;
  },
  tcpOptions?: {
    host?: string;
    port?: number;
    options?: ServerOpts;
  }
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
  });
  return {host, port, server};
}
