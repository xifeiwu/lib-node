import {TLSSocket} from 'tls';
import {httpRequestOptionsToHttpInfo} from '../../../http';
import {connectToSocksServer} from '../client';
import {SOCKS_AUTH_USER_PASS} from '../service';
import {httpRequestInfoToBuffer, HttpRequestOptions, logColorful} from '../service/external';

const googleGet: HttpRequestOptions = {
  method: 'get',
  // url: 'https://www.google.com/chrome/static/images/v2/accordion-timed/themes-poster.webp',
  // url: 'http://elif.site/api/debug/echo',
  // url: `https://www.google.com/generate_204?5qqoow`,
  url: 'https://www.google.com/search?q=net&rlz=1C5GCEM_en&oq=net&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGDsyBggCEEUYPTIGCAMQRRg8MgYIBBBFGEEyBggFEEUYQTIGCAYQRRhBMgYIBxBFGDzSAQcyODBqMGo0qAIAsAIB&sourceid=chrome&ie=UTF-8',
};

const googlePost: HttpRequestOptions = {
  method: 'post',
  url: `https://www.google.com/gen_204?s=webhp&t=cap&atyp=csi&ei=rGO9Z5_kBajk1e8Pk4qgoAk&rt=wsrt.16077,hst.455,cbt.456&opi=89978449&dt=&ts=300&ant=push`,
  headers: {
    'content-length': 0,
  },
};
const githubGet: HttpRequestOptions = {
  method: 'get',
  url: `https://github.com/Conviva-Internal/Instant-Filter-Server/pull/2104`,
}

const httpRequestOptions = githubGet;
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
