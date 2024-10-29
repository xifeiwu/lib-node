import assert from 'assert';
import {requestAndGetResponseInfo, startHttpDebugServer} from '../http';
import {startSocketClient} from '../net';
import {startTcpProxyServer} from './server';
import {Socket} from 'net';
import {TcpHandler} from '../index';

async function getHttpHandler() {
  const {host, port} = await startHttpDebugServer();
  return async socket => {
    const proxyClient = await startSocketClient({host, port});
    socket.pipe(proxyClient).pipe(socket);
  };
}

const tcpHandler: TcpHandler = async (socket: Socket) => {
  socket.on('data', chunk => {
    socket.write(chunk);
  });
};
export async function testStartProxyableTcpServer() {
  const {host, port, server} = await startTcpProxyServer({
    httpHandler: await getHttpHandler(),
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
