import {getBufferGenerator} from 'transform';
import {startSocketServer} from './server';
import {watchSocketState} from './utils';
import {startSocketClient} from './client';
import {waitFor} from '../../index';

export async function testSocketConnection() {
  const {host, port, server} = await startSocketServer(async socket => {
    watchSocketState(socket, {colorStyle: {color: 'red'}});
    const generator = getBufferGenerator({source: 'a', count: 3});
    let data: Buffer;
    while ((data = generator())) {
      await waitFor(3000);
      socket.write(data);
    }
  });
  const client = await startSocketClient({host, port});
  watchSocketState(client, {colorStyle: {color: 'blue'}});
  const generator = getBufferGenerator({source: '1', count: 3});
  let data: Buffer;
  while ((data = generator())) {
    await waitFor(1000);
    client.write(data);
  }
}
