import assert from 'assert';
import {Socket} from 'net';
import {HttpDebugServerPath} from '../../external';
import {requestAndGetResponseInfo, startHttpDebugServer} from '../../http';
import {startSocketClient} from '../../net';
import {startTcpConnectionRouter} from './server';
import {TcpHandler} from './types';

const echoData: TcpHandler = async (socket: Socket) => {
  socket.on('data', chunk => {
    socket.write(chunk);
  });
};

export async function testStartProxyableTcpServer() {
  const httpServerInfo = await startHttpDebugServer();
  const {host, port, server} = await startTcpConnectionRouter({
    router: {
      http: httpServerInfo,
    },
    tcpHandler: echoData,
  });
  try {
    const {responseInfo} = await requestAndGetResponseInfo({
      origin: `http://${host}:${port}`,
      pathname: HttpDebugServerPath.echo,
      method: 'post',
      data: {
        a: 1,
        b: 'b',
      },
    });
    /** test route to http */
    assert.equal(HttpDebugServerPath.echo, responseInfo.data.url);
    const client = await startSocketClient({host, port});
    /** test route to tcp */
    const toSend = 'abc';
    client.write(toSend);
    const replyFromServer = await new Promise<string>(resolve => {
      client.on('data', chunk => {
        resolve(chunk.toString());
      });
    });
    assert.equal(toSend, replyFromServer);
    client.end();
  } finally {
    server.close();
    httpServerInfo.server.close();
  }
}
