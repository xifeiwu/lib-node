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
  startSocketClient,
} from '../../service/external';
import {requestThroughHttpAndPrintResponse, selectAndRequireFile} from '../../service/external';
import {Socket} from 'net';
import {EMethod} from '../../types/v5';
import {largeDataToString} from '../../../../transform';
import {HttpRequestInfo, HttpRequestInfoFull} from '../../../../types';

async function selectRequestOptions() {
  const selected = await selectAndRequireFile<{httpRequestOptions: HttpRequestOptions}>([
    {targetDir: path.resolve(__dirname, 'request-options')},
  ]);
  return selected.httpRequestOptions;
}

async function sendDataOverTcpAndCheckResponse(httpRequestOptions: HttpRequestOptions, socket: Socket) {
  const info: HttpRequestInfoFull = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const {info: requestInfo, urlInst: url} = info;
  let reader: Socket;
  // const buffer = httpRequestInfoToBuffer(requestInfo);
  // logColorful({}, '--start--');
  // logColorful({}, buffer);
  // logColorful({}, '--end--');
  try {
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
    let chunkIndex = 0;
    reader.on('data', chunk => {
      const length = chunk.byteLength;
      totalSize += length;
      logColorful({}, chunk.toString());
      logColorful({color: 'red'}, `${chunkIndex}. ${length}/${totalSize}`);
      /** print first chunk as it contains head info */
      if (chunkIndex === 0) {
        logColorful({}, largeDataToString(chunk, {maxPrintSize: 1000}));
      }
      // @ts-ignore
      logColorful({}, getSocketInfo(socket));
      chunkIndex++;
    });
    reader.on('end', chunk => {
      logColorful({color: 'red'}, totalSize);
    });
  } catch (err) {
    console.log(err);
  }
}
export async function byPipeSocket() {
  const httpRequestOptions = await selectRequestOptions();
  const {target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const socket = await startSocketClient(target);
  await sendDataOverTcpAndCheckResponse(httpRequestOptions, socket);
}

/**
 * Notice:
 * Should not use getDataFromReadable to get whole response data, as end event will not be triggered.
 */
export async function bySocksServer() {
  const httpRequestOptions = await selectRequestOptions();
  const {info, urlInst: url, target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const status = await connectToSocksServer({
    socksVersion: 1,
    auth: SOCKS_AUTH_USER_PASS,
    // socksVersion: 5,
    // methodList: [{method: EMethod.NoAuth}],
    // methodList: [{method: EMethod.UserPass, info: SOCKS_AUTH_USER_PASS}],
    // socksServer: 'http://elif.site',
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
  await sendDataOverTcpAndCheckResponse(httpRequestOptions, socket);
}

export async function requestThroughHttp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughHttpAndPrintResponse(requestOptions);
}

export async function requestThroughTcp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughTcpAndPrintResponse(requestOptions);
}
