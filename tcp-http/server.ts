import {ServerOpts, Socket} from 'net';
import {Readable} from 'stream';
import {EventEmitter} from 'events';
import {startSocketServer, watchSocketState} from '../net';
import {getDataFromReadable, getOneLineFromReader} from '../stream';
import {httpFirstLineReg} from '../constants';
import {HttpIncomingMessage} from './service';
import {responseInfoToBuffer} from '../http';

async function handleConnectionAsHttp(socket: Socket) {
  const incomingMessage = new HttpIncomingMessage(socket);
  await incomingMessage.parse();
  // logColorful({color: 'yellow'}, 'headerPart Info:', incomingMessage.headerPartProps);
  watchSocketState(socket, {colorStyle: {color: 'yellow'}, bytesToPrint: 300});
  const data = await getDataFromReadable(incomingMessage);
  const requestInfo = {
    ...incomingMessage.headerPartProps,
    data: data.toString(),
  };
  socket.end(
    responseInfoToBuffer({
      data: requestInfo,
    })
  );
}

function isHttpRequest(buffer: Buffer) {
  const str = buffer.toString();
  return httpFirstLineReg.test(str);
}

export async function startSyntheticServer(
  config: {
    onConnection?: (socket: Socket) => Promise<boolean | void>;
    tcpHandler?: (firstChunk: Buffer, socket: Socket) => Promise<boolean | void>;
  },
  tcpOptions?: {
    host?: string;
    port?: number;
    options?: ServerOpts;
  }
) {
  const {onConnection, tcpHandler} = config;

  const {host, port, server} = await startSocketServer(async socket => {
    if (onConnection && (await onConnection(socket)) === false) {
      socket.writable && socket.end(`closed by server side`);
      return;
    }
    const bufferOfFirstLine = await getOneLineFromReader(socket, {firstChunkOnly: true});
    if (isHttpRequest(bufferOfFirstLine)) {
      socket.unshift(bufferOfFirstLine);
      await handleConnectionAsHttp(socket);
    } else {
      socket.unshift(bufferOfFirstLine);
      socket.on('data', chunk => {
        socket.write(chunk);
      });
    }
  });
  return {host, port, server};
}
