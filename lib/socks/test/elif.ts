import {TLSSocket} from 'tls';
import {connectToSocksServer} from '../client';
import {SOCKS_AUTH_USER_PASS} from '../service';
import {
  httpRequestInfoToBuffer,
  HttpRequestOptions,
  logColorful,
  requestAndGetResponseInfo,
  httpRequestOptionsToHttpInfo,
  getDataFromReadable,
  httpRequestOptionsToCurlCommand,
  sendHttpRequestByTcp,
} from '../service/external';
import {Readable} from 'stream';
import {startHttpDebugServerOnTcp} from '../../../http';
import {getDefaultTlsConfig} from '../../../net';

const elifEcho: HttpRequestOptions = {
  method: 'get',
  origin: 'https://elif.site/api/debug/echo',
  headers: {
    host: 'elif.site',
  },
  // origin: 'http://elif.site/api/debug/echo',
};
const nodejsOrg: HttpRequestOptions = {
  method: 'get',
  url: 'https://nodejs.org/docs/latest/api/',
  headers: {
    // 'content-length': 0,
    // host: 'nodejs.org',
    // connection: 'close',
  },
  // url: 'https://www.google.com/chrome/static/images/v2/accordion-timed/themes-poster.webp',
  // url: 'https://elif.site/api/debug/echo',
  // url: `https://www.google.com/generate_204?5qqoow`,
  // url: 'https://www.google.com/search?q=net&rlz=1C5GCEM_en&oq=net&gs_lcrp=EgZjaHJvbWUqBggAEEUYOzIGCAAQRRg7MgYIARBFGDsyBggCEEUYPTIGCAMQRRg8MgYIBBBFGEEyBggFEEUYQTIGCAYQRRhBMgYIBxBFGDzSAQcyODBqMGo0qAIAsAIB&sourceid=chrome&ie=UTF-8',
};

const googlePost: HttpRequestOptions = {
  method: 'post',
  url: `https://www.google.com/gen_204?s=webhp&t=cap&atyp=csi&ei=rGO9Z5_kBajk1e8Pk4qgoAk&rt=wsrt.16077,hst.455,cbt.456&opi=89978449&dt=&ts=300&ant=push`,
  headers: {
    'content-length': 0,
  },
};
const homeBrewInstall: HttpRequestOptions = {
  method: 'get',
  url: 'https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh',
  // url: 'https://elif.site/api/debug/echo',
  headers: {
    host: 'raw.githubusercontent.com',
    accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
    'cache-control': 'no-cache',
    pragma: 'no-cache',
    priority: 'u=0, i',
    'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.3',
  },
};

// const httpRequestOptions = nodejsOrg;
const httpRequestOptions: HttpRequestOptions = {
  method: 'get',
  url: 'https://javdb.com/packs/js/app-e59c8b5d8adedd2a1f1d.js',
  headers: {
    'Upgrade-Insecure-Requests': 1,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': 'macOS',
  },
};

/**
 * Notice:
 * Should not use getDataFromReadable to get whole response data, as end event will not be triggered.
 */
export async function bySocketServer() {
  const {info, urlInst: url, target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
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
  let reader: Readable;
  const buffer = httpRequestInfoToBuffer(info);
  logColorful({}, '--start--');
  logColorful({}, buffer);
  logColorful({}, '--end--');
  if (url.protocol === 'https:') {
    const tlsSocket = new TLSSocket(socket);
    tlsSocket.write(buffer);
    reader = tlsSocket;
  } else {
    socket.write(buffer);
    reader = socket;
  }
  reader.on('data', chunk => {
    logColorful({}, chunk.toString());
  });
  reader.on('end', chunk => {
    logColorful({color: 'red'}, 'end', chunk ? chunk.toString() : '');
  });
}

export async function requestByHttpAndTcp() {
  const {origin, server} = await startHttpDebugServerOnTcp({options: getDefaultTlsConfig()});
  // Echo request entity by setting url to origin of debugServer
  httpRequestOptions.url = origin;

  const {requestOptions, responseInfo} = await requestAndGetResponseInfo(httpRequestOptions);
  logColorful({}, requestOptions);
  logColorful({}, responseInfo);
  logColorful({}, httpRequestOptionsToCurlCommand(requestOptions));

  const client = (await sendHttpRequestByTcp(httpRequestOptions)) as TLSSocket;
  const response = await getDataFromReadable(client);
  logColorful({}, response);
  server.close();
}

export async function requestByTcp() {
  const client = (await sendHttpRequestByTcp(httpRequestOptions)) as TLSSocket;
  const certificate = client.getPeerCertificate();
  const publicKey = certificate.pubkey;
  console.log('Public Key:', publicKey);
  console.log('Certificate:', certificate);

  const response = await getDataFromReadable(client);
  logColorful({}, response);
}
