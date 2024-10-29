import {connectToSocksServer} from '../client';
import {basicAuth, serializeErrorInfo} from '../service';
import {getDataFromReadable, logColorful, tcpRequestPropsToBuffer} from '../service/external';

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
    auth: basicAuth,
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
    auth: basicAuth,
    requestTarget: {
      address: 'elif.site',
      port: 80,
    },
  });
  const {socket, error} = status;
  if (error) {
    logColorful({}, serializeErrorInfo(error));
    return;
  }
  socket.write(httpBuffer);
  socket.on('data', chunk => {
    logColorful({}, chunk.toString());
  })
  // const response = await getDataFromReadable(socket);
  // console.log(response.toString());
}
