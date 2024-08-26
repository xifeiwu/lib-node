/**
 * How tcp connection is handled by http protocol
 */

import {
  getHttpIncomingMessage,
  httpOptionsToTcpConfig,
  startSocketClient,
  startSocketServer,
  tcpRequestPropsToBuffer,
  watchSocketState,
} from '../index';
import {
  getRequestHeaderInfo,
  responseInfoToBuffer,
  responseRequestEvent,
  sendHttpRequest,
  startHttpServer,
} from '../../http';
import {HttpRequestOptions} from '../../types';
import {getDataFromReadable} from '../../stream';
import {logColorful} from '../../log';

export async function tcpServer() {
  const {host, port, server} = await startSocketServer(async socket => {
    /** Should not consume data before parsing header part finished */
    const incomingMessage = await getHttpIncomingMessage(socket);
    logColorful({color: 'yellow'}, 'headerPart Info:', incomingMessage.headerPartProps);
    watchSocketState(socket, {color: 'yellow'});
    const data = await getDataFromReadable(incomingMessage);
    const requestInfo = {
      ...incomingMessage.headerPartProps,
      data,
    };
    socket.end(
      responseInfoToBuffer({
        data: requestInfo,
      })
    );
  });
  return {host, port, server};
}

export async function httpServer() {
  const {origin, server} = await startHttpServer({
    request(request, response) {
      logColorful({color: 'yellow'}, 'headerPart Info:', getRequestHeaderInfo(request));
      watchSocketState(request.socket, {color: 'yellow'});
      responseRequestEvent(request, response);
    },
  });
  console.log(`start http server: ${origin}`);
  return {origin, server};
}

// const requestOptins: HttpRequestOptions =
function getRequestOptions(options: Required<Pick<HttpRequestOptions, 'origin'>>): HttpRequestOptions {
  const defaultOptions: HttpRequestOptions = {
    method: 'post',
    pathname: '/Echo',
    headers: {
      TRACE_id: '123',
    },
    data: 'abc',
  };
  return {
    ...defaultOptions,
    ...options,
  };
}

function httpClient(origin: string) {
  const client = sendHttpRequest(getRequestOptions({origin}));
  client.on('socket', socket => {
    watchSocketState(socket, {color: 'cyan'});
    socket.on('data', chunk => {
      console.log(chunk.toString());
    });
  });
}

async function tcpClient(origin: string) {
  const {props, connectionOptions} = httpOptionsToTcpConfig(
    getRequestOptions({
      origin,
    })
  );
  const client = await startSocketClient(connectionOptions);
  watchSocketState(client, {color: 'cyan'});
  client.end(tcpRequestPropsToBuffer(props));
  client.on('data', chunk => {
    console.log(`chunk.toString()`);
    console.log(chunk.toString());
  });
}
export async function httpServerhttpClient() {
  const {origin} = await httpServer();
  httpClient(origin);
}

export async function httpServerTcpClient() {
  const {origin} = await httpServer();
  tcpClient(origin);
}

export async function tcpServerhttpClient() {
  const {host, port} = await tcpServer();
  // const {host, port} = {
  //   host: '127.0.0.1',
  //   port: 3001,
  // };
  httpClient(`http://${host}:${port}`);
}

export async function tcpServertcpClient() {
  const {host, port} = await tcpServer();
  tcpClient(`http://${host}:${port}`);
}
