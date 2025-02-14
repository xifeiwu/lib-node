import {TLSSocket} from 'tls';
import {httpRequestOptionsToHttpInfo} from '../../../http';
import {connectToSocksServer} from '../client';
import {SOCKS_AUTH_USER_PASS} from '../service';
import {httpRequestInfoToBuffer, HttpRequestOptions, logColorful} from '../service/external';

const httpRequestOptions: HttpRequestOptions = {
  method: 'get',
  url: 'https://www.google.com/chrome/static/images/v2/accordion-timed/themes-poster.webp',
  // url: 'http://elif.site/api/debug/echo',
};

/**
 * Notice:
 * Should not use getDataFromReadable to get whole response data, as end event will not be triggered.
 */
export async function bySocketServer() {
  const {info, url, target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const status = await connectToSocksServer({
    socksVersion: 1,
    socksServer: {
      host: 'elif.site',
      port: 80,
    },
    auth: SOCKS_AUTH_USER_PASS,
    requestTarget: {
      address: target.host,
      port: target.port,
    },
  });
  const {socket} = status;
  if (url.protocol === 'https:') {
    const tlsSocket = new TLSSocket(socket);
    tlsSocket.write(httpRequestInfoToBuffer(info));
    tlsSocket.on('data', chunk => {
      logColorful({}, chunk.toString());
    });
    // const response = await getDataFromReadable(tlsSocket);
    // console.log(response.toString());
  } else {
    socket.write(httpRequestInfoToBuffer(info));
    socket.on('data', chunk => {
      logColorful({}, chunk.toString());
    });
    // const response = await getDataFromReadable(socket);
    // console.log(response.toString());
  }
}
