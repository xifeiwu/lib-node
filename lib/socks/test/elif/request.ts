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
import {requestThroughHttpAndPrintResponse, selectAndRequireFile} from '../../service/external';
import {Socket} from 'net';
import {EMethod} from '../../types/v5';

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
    auth: SOCKS_AUTH_USER_PASS,
    // socksVersion: 5,
    // methodList: [{method: EMethod.NoAuth}],
    // methodList: [{method: EMethod.UserPass, info: SOCKS_AUTH_USER_PASS}],
    socksServer: {
      // host: 'elif.site',
      // port: 80,
      host: '127.0.0.1',
      port: 3160,
    },
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
      servername: url.hostname,
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
    const length = chunk.byteLength;
    totalSize += length;
    // logColorful({}, chunk.toString());
    logColorful({color: 'red'}, `${length}/${totalSize}`);
    logColorful({}, getSocketInfo(reader));
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
