import tls from 'tls';
import path from 'path';
import {connectToSocksServer} from '../../client';
import {SOCKS_AUTH_DEFAULT_USER_PASS} from '../../service';
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
import {largeDataToString} from '../../../../transform';
import {HttpRequestInfo, HttpRequestInfoFull} from '../../../../types';
import {startTcpServerForSocks} from '../service';

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
      /** RST here ⇒ problem on SOCKS / VC1 tunnel (proxy or XOR leg), not TLS to origin. */
      socket.once('error', err => {
        logColorful({color: 'red'}, '[phase] SOCKS tunnel socket error (before/during TLS):', err);
      });
      // const tlsSocket = new TLSSocket(socket, {isServer: false, servername: ''});
      logColorful({}, '[phase] start TLS over SOCKS tunnel →', url.hostname);
      const tlsSocket = tls.connect({
        socket,
        servername: url.hostname,
      });
      await new Promise<void>((res, rej) => {
        tlsSocket.once('secureConnect', () => res());
        tlsSocket.once('error', rej);
      });
      logColorful({}, '[phase] TLS established');
      logColorful({}, tlsSocket.bytesRead, tlsSocket.bytesWritten);
      reader = tlsSocket;
    } else {
      // socket.end(buffer);
      reader = socket;
    }
    reader.on('error', err => {
      logColorful({color: 'red'}, 'reader error:', err);
    });
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

/**
 * Notice:
 * Should not use getDataFromReadable to get whole response data, as end event will not be triggered.
 */
export async function bySocksServer() {
  const {host, port} = await startTcpServerForSocks();
  const httpRequestOptions = await selectRequestOptions();
  const {target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const status = await connectToSocksServer({
    socksVersion: 1,
    auth: SOCKS_AUTH_DEFAULT_USER_PASS,
    // socksVersion: 5,
    // methodList: [{method: EMethod.NoAuth}],
    // methodList: [{method: EMethod.UserPass, info: SOCKS_AUTH_DEFAULT_USER_PASS}],
    // socksServer: 'http://elif.site',
    socksServer: {
      host: 'elif.site',
      port: 80,
      // host,
      // port,
      // host: '127.0.0.1',
      // port: 3160,
    },
    requestTarget: {
      address: target.host,
      port: target.port,
    },
  });
  if (status.error) {
    logColorful({color: 'red'}, 'SOCKS negotiation failed:', status.error);
    logColorful({}, status.stateTracer);
    throw status.error;
  }
  const {socket} = status;
  if (!socket) {
    throw new Error('connectToSocksServer: no socket after successful negotiation');
  }
  await sendDataOverTcpAndCheckResponse(httpRequestOptions, socket);
  1;
}

export async function requestThroughHttp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughHttpAndPrintResponse(requestOptions);
}

export async function requestThroughTcp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughTcpAndPrintResponse(requestOptions);
}

export async function byPipeSocket() {
  const httpRequestOptions = await selectRequestOptions();
  const {target} = httpRequestOptionsToHttpInfo(httpRequestOptions);
  const socket = await startSocketClient(target);
  await sendDataOverTcpAndCheckResponse(httpRequestOptions, socket);
}
