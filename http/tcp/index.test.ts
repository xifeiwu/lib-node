/**
 * How tcp connection is handled by http protocol
 */

import {
  getDataFromReadable,
  logColorful,
  startSocketClient,
  startSocketServer,
  watchSocketState,
} from '../../index';
import {
  httpOptionsToTcpConfig,
  sendHttpRequest,
  startHttpDebugServer,
  tcpRequestPropsToBuffer,
} from '../index';
import {HttpRequestOptions} from '../../types';
import {Socket} from 'net';
import {HttpIncomingMessage} from './components';
import {responseInfoToBuffer} from './components/common';

export async function getHttpIncomingMessage(socket: Socket, options?: {}) {
  const incomingMessage = new HttpIncomingMessage(socket);
  await incomingMessage.parse();
  return incomingMessage;
}
export async function tcpServer() {
  const {host, port, server} = await startSocketServer(async socket => {
    /** Should not consume data before parsing header part finished */
    const incomingMessage = await getHttpIncomingMessage(socket);
    logColorful({color: 'yellow'}, 'headerPart Info:', incomingMessage.headerPartProps);
    watchSocketState(socket, {colorStyle: {color: 'yellow'}});
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
  const {origin, server} = await startHttpDebugServer();
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
    data: {key: 'abc'},
  };
  return {
    ...defaultOptions,
    ...options,
  };
}

function httpClient(config: {origin: string; watchSocketState?: boolean}) {
  const {origin} = config;
  const client = sendHttpRequest(getRequestOptions({origin}));
  client.on('socket', socket => {
    config.watchSocketState && watchSocketState(socket, {colorStyle: {color: 'cyan'}});
    socket.on('data', chunk => {
      logColorful({color: 'blue'}, 'server response:');
      console.log(chunk.toString());
    });
  });
}

async function tcpClient(config: {origin: string; watchSocketState?: boolean}) {
  const {origin} = config;
  const {props, connectionOptions} = httpOptionsToTcpConfig(
    getRequestOptions({
      origin,
    })
  );
  const client = await startSocketClient(connectionOptions);
  config.watchSocketState && watchSocketState(client, {colorStyle: {color: 'cyan'}});
  client.end(tcpRequestPropsToBuffer(props));
  client.on('data', chunk => {
    logColorful({color: 'blue'}, 'onData:');
    console.log(chunk.toString());
  });
}
export async function httpServerhttpClient() {
  const {origin} = await httpServer();
  httpClient({origin});
}

export async function httpServerTcpClient() {
  const {origin} = await httpServer();
  tcpClient({origin});
}

export async function tcpServerhttpClient() {
  const {host, port} = await tcpServer();
  // const {host, port} = {
  //   host: '127.0.0.1',
  //   port: 3001,
  // };
  httpClient({origin: `http://${host}:${port}`});
}

export async function tcpServertcpClient() {
  const {host, port} = await tcpServer();
  tcpClient({origin: `http://${host}:${port}`});
}
