import {connectToSocksServer} from '../client';
import {SOCKS_AUTH_USER_PASS, serializeErrorInfo} from '../service';
import {getDataFromReadable, httpRequestInfoToBuffer, logColorful, tcpRequestPropsToBuffer} from '../service/external';

const httpBuffer = httpRequestInfoToBuffer({
  method: 'get',
  url: 'https://www.google.com/chrome/static/images/v2/accordion-timed/themes-poster.webp',
  httpVersion: 'HTTP/1.1',
});

export async function bySocketServer() {
  const status = await connectToSocksServer({
    socksVersion: 1,
    socksServer: {
      host: 'elif.site',
      port: 80,
    },
    auth: SOCKS_AUTH_USER_PASS,
    requestTarget: {
      address: 'www.google.com',
      port: 443,
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
    auth: SOCKS_AUTH_USER_PASS,
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
  });
  // const response = await getDataFromReadable(socket);
  // console.log(response.toString());
}
