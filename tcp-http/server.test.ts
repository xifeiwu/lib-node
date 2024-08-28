import assert from 'assert';
import {requestAndGetResponseInfo} from '../http';
import {startSocketClient} from '../net';
import {startSyntheticServer} from './server';

export async function testStartSyntheticServer() {
  const {host, port, server} = await startSyntheticServer({});
  const responseInfo = await requestAndGetResponseInfo({
    origin: `http://${host}:${port}`,
    pathname: '/api/debug/echo',
    method: 'post',
    data: {
      a: 1,
      b: 'b',
    },
  });
  assert.equal('/api/debug/echo', responseInfo.data.url)
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
