import assert from 'assert';
import {requestAndGetResponseInfo, responseInfoToBuffer} from '../http';
import {startSocketClient} from '../net';
import {startSyntheticServer} from './server';
import {Socket} from 'net';
import {HttpIncomingMessage} from './service';
import {getDataFromReadable} from '../stream';

async function httpHandler(socket: Socket) {
  const incomingMessage = new HttpIncomingMessage(socket);
  await incomingMessage.parse();
  // logColorful({color: 'yellow'}, 'headerPart Info:', incomingMessage.headerPartProps);
  // watchSocketState(socket, {colorStyle: {color: 'yellow'}, bytesToPrint: 300});
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
function tcpHandler(socket: Socket, chunk: Buffer) {
  socket.on('data', chunk => {
    socket.write(chunk);
  });
}
export async function testStartSyntheticServer() {
  const {host, port, server} = await startSyntheticServer({
    httpHandler,
    tcpHandler,
  });
  const responseInfo = await requestAndGetResponseInfo({
    origin: `http://${host}:${port}`,
    pathname: '/api/debug/echo',
    method: 'post',
    data: {
      a: 1,
      b: 'b',
    },
  });
  assert.equal('/api/debug/echo', responseInfo.data.url);
  const client = await startSocketClient({host, port});
  const toSend = 'abc';
  client.write(toSend);
  const replyFromServer = await new Promise<string>(resolve => {
    client.on('data', chunk => {
      resolve(chunk.toString());
    });
  });
  assert.equal(toSend, replyFromServer);
  client.end();
  server.close();
}
