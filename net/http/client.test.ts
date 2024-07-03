import {tcpRequestPropsToBuffer} from './client';
import {handleSocketEvents, startSocketClient} from '../utils';

export async function testGetRequestData() {
  const socket = await startSocketClient({
    host: 'elif.site',
    port: 80,
  });
  handleSocketEvents(socket);
  socket.end(
    tcpRequestPropsToBuffer({
      method: 'post',
      url: '/api/debug/echo',
      headers: {
        from: 'test',
      },
      data: {
        a: 1,
        b: 2,
      },
    })
  );
}

export async function sendRequestDataByChunk() {
  const socket = await startSocketClient({
    host: 'elif.site',
    port: 80,
  });
  const total = tcpRequestPropsToBuffer({
    method: 'post',
    url: '/api/debug/echo',
    headers: {
      from: 'test',
    },
    data: {
      a: 1,
      b: 2,
    },
  });
  const index = 20;
  const firstPart = total.subarray(0, index);
  const remainingPart = total.subarray(index);
  handleSocketEvents(socket);
  socket.write(firstPart);
  socket.end(remainingPart);
}
