import {startSocketServer} from './server';
import {watchSocketState} from './common';
import {startSocketClient} from './client';
import {getBufferGenerator} from '../../index';
import {waitFor} from '../../external';

export async function testSocketConnection() {
  const {host, port, server} = await startSocketServer(async socket => {
    watchSocketState(socket, {colorStyle: {color: 'red'}});
    const generator = getBufferGenerator({source: 'a', generateCount: 3});
    let data: Buffer;
    while ((data = generator())) {
      await waitFor(3000);
      socket.write(data);
    }
  });
  const client = await startSocketClient({host, port});
  watchSocketState(client, {colorStyle: {color: 'blue'}});
  const generator = getBufferGenerator({source: '1', generateCount: 3});
  let data: Buffer;
  while ((data = generator())) {
    await waitFor(1000);
    client.write(data);
  }
}
