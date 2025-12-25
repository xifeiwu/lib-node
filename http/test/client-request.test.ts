import {logWithColor} from '../../log';
import {handleSocketEvents, watchSocketState, writeDataByInterval} from '../../net';
import {
  requestAndGetConnectInfo,
  requestAndGetResponseInfo,
  requestAndGetUpgradeInfo,
  upgradeToWebsocket,
  getHttpResponseInfo,
} from '../client';
import {
  getHttpRequestInfo,
  handleConnectEvent,
  handleWebsocketUpgrade,
  responseHttpRequestInfo,
  startHttpDebugServer,
  startHttpServer,
} from '../server';
import {httpResponseInfoToBuffer} from '../tcp';

export async function testRequestAndGetResponseInfo() {
  const {origin, server} = await startHttpDebugServer();
  const {
    responseInfo: {statusCode, data, headers},
  } = await requestAndGetResponseInfo({
    url: `${origin}/api/debug/echo`,
    pathnameParams: {
      action: 'echo',
    },
    query: {
      ts: Date.now(),
    },
    method: 'post',
    headers: {
      'trace-id': 'abc',
    },
    data: {
      a: 1,
      b: 2,
    },
  });
  console.log({statusCode, data, headers});
  server.close();
}

export async function testUpgradeToWebsocket() {
  const {server, origin} = await startHttpServer({
    async request(req, res) {
      // console.log(await getRequestInfo(req));
      responseHttpRequestInfo(res, req);
    },
    async upgrade(req, socket, head) {
      const responseInfo = handleWebsocketUpgrade(req, socket, head);
      socket.write(await httpResponseInfoToBuffer(responseInfo));
      // handleSocketEvents(socket, {isServer: true, color: 'red'});
      socket.on('data', chunk => {
        socket.write(chunk);
      });
    },
  });
  const {socket} = await upgradeToWebsocket({
    origin,
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
    },
  });
  // handleSocketEvents(socket, {color: 'green'});
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  setTimeout(() => {
    socket.write('abc');
    // writeDataByInterval(socket, {endStr: 'bye'});
  });
}

export async function getSocketByConnect() {
  const {server, origin} = await startHttpServer({
    async request(req, rep) {
      throw new Error('should no go here');
    },
    async connect(req, socket, head) {
      const {responseInfo} = handleConnectEvent(req);
      socket.write(await httpResponseInfoToBuffer(responseInfo));
      handleSocketEvents(socket, {isServer: true, color: 'red'});
      socket.on('end', () => {
        socket.end();
      });
    },
  });
  const {response, socket, head} = await requestAndGetConnectInfo({
    // origin: 'http://elif.site',
    origin,
    method: 'connect',
    data: {
      a: 1,
      b: 2,
    },
  });
  const resInfo = await getHttpResponseInfo(response);
  console.log(resInfo, head.toString());
  handleSocketEvents(socket, {color: 'green'});
  setTimeout(() => {
    writeDataByInterval(socket, {endStr: 'bye'});
  });
  server.close();
}

export async function swithHttpToSocks() {
  const {origin} = await startHttpServer({
    async request(req, rep) {
      console.log(await getHttpRequestInfo(req));
    },
    async upgrade(req, socket, head) {
      logWithColor('red', await getHttpRequestInfo(req));
      socket.write(
        'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
          'Upgrade: socks5\r\n' +
          'Connection: Upgrade\r\n' +
          '\r\n'
      );
      handleSocketEvents(socket, {isServer: true, color: 'red'});
      socket.on('end', () => {
        socket.end();
      });
    },
  });
  const {socket} = await requestAndGetUpgradeInfo({
    origin,
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'socks5',
    },
  });
  handleSocketEvents(socket, {color: 'green'});
  setTimeout(() => {
    writeDataByInterval(socket, {endStr: 'bye'});
  });
}
