import tls from 'tls';
import path from 'path';
import {connectToSocksServer} from '../../client';
import {SOCKS_AUTH_USER_PASS} from '../../service';
import {
  httpRequestInfoToBuffer,
  HttpRequestOptions,
  logColorful,
  httpRequestOptionsToHttpInfo,
  sendHttpRequestByTcp,
  requestThroughTcpAndPrintResponse,
  getSocketInfo,
} from '../../service/external';
import {Readable} from 'stream';
import {requestThroughHttpAndPrintResponse, selectAndRequireFile} from '../../service/external';
import {Socket} from 'net';

async function selectRequestOptions() {
  const selected = await selectAndRequireFile<{httpRequestOptions: HttpRequestOptions}>([
    {targetDir: path.resolve(__dirname, 'request-options')},
  ]);
  return selected.httpRequestOptions;
}

/**
 * Notice:
 * Should not use getDataFromReadable to get whole response data, as end event will not be triggered.
 */
export async function bySocketServer() {
  const httpRequestOptions = await selectRequestOptions();
  const {info, urlInst: url, target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const status = await connectToSocksServer({
    socksVersion: 1,
    socksServer: {
      // host: 'elif.site',
      // port: 80,
      host: '127.0.0.1',
      port: 3160
    },
    auth: SOCKS_AUTH_USER_PASS,
    requestTarget: {
      address: target.host,
      port: target.port,
    },
  });
  const {socket} = status;
  let reader: Socket;
  const buffer = httpRequestInfoToBuffer(info);
  logColorful({}, '--start--');
  logColorful({}, buffer);
  logColorful({}, '--end--');
  if (url.protocol === 'https:') {
    // const tlsSocket = new TLSSocket(socket, {isServer: false, servername: ''});
    const tlsSocket = tls.connect({
      socket,
      servername: 'javdb.com',
    });
    await new Promise((res, rej) => {
      tlsSocket.on('secureConnect', res);
      tlsSocket.on('error', rej);
    });
    logColorful({}, tlsSocket.bytesRead, tlsSocket.bytesWritten);
    reader = tlsSocket;
  } else {
    // socket.end(buffer);
    reader = socket;
  }
  await sendHttpRequestByTcp(httpRequestOptions, reader);
  let totalSize = 0;
  reader.on('data', chunk => {
    totalSize += chunk.byteLength;
    logColorful({}, chunk.toString());
    logColorful({color: 'red'}, getSocketInfo(reader));
  });
  reader.on('end', chunk => {
    logColorful({color: 'red'}, totalSize);
  });
}

export async function requestThroughHttp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughHttpAndPrintResponse(requestOptions);
}

export async function requestThroughTcp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughTcpAndPrintResponse(requestOptions);
}

// export async function requestByHttpAndTcp() {
//   // const {origin, server} = await startHttpDebugServerOnTcp({options: getDefaultTlsConfig()});
//   // Echo request entity by setting url to origin of debugServer
//   // httpRequestOptions.url = origin;

//   const {requestOptions, responseInfo} = await requestAndGetResponseInfo(httpRequestOptions);
//   logColorful({}, requestOptions);
//   logColorful({}, responseInfo);
//   logColorful({}, httpRequestOptionsToCurlCommand(requestOptions));

//   const client = (await sendHttpRequestByTcp(httpRequestOptions)) as TLSSocket;
//   const response = await getDataFromReadable(client);
//   logColorful({}, response);
//   // server.close();
// }

// export async function requestByTcp() {
//   const client = (await sendHttpRequestByTcp(httpRequestOptions)) as TLSSocket;
//   const certificate = client.getPeerCertificate();
//   const publicKey = certificate.pubkey;
//   console.log('Public Key:', publicKey);
//   console.log('Certificate:', certificate);

//   const response = await getDataFromReadable(client);
//   logColorful({}, response);
// }
