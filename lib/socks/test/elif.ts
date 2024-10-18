import {connectToSocksServer} from '../client';
import {getDataFromReadable, tcpRequestPropsToBuffer} from '../service/external';

const httpBuffer = tcpRequestPropsToBuffer({
  method: 'get',
  url: '/api/socks/list',
  // data: {a: 1},
});
export async function bySocketServer() {
  const status = await connectToSocksServer({
    socksVersion: 1,
    socksServer: {
      host: 'elif.site',
      port: 80,
    },
    auth: {
      username: 'abc',
      password: 'dddd',
    },
    requestTarget: {
      address: 'elif.site',
      port: 80,
    },
  });
  const {socket} = status;
  socket.write(httpBuffer);
  const response = await getDataFromReadable(socket);
  console.log(response.toString());
}

export async function byHttpUpgrade() {
  const status = await connectToSocksServer({
    socksVersion: 1,
    socksServer: 'http://elif.site',
    auth: {
      username: 'abc',
      password: 'dddd',
    },
    requestTarget: {
      address: 'elif.site',
      port: 80,
    },
  });
  const {socket} = status;
  socket.write(httpBuffer);
  const response = await getDataFromReadable(socket);
  console.log(response.toString());
}
