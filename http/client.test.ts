import {logWithColor} from '../log';
import {handleSocketEvents, writeDataByInterval} from '../net';
import {toBuffer} from '../transform';
import {requestAndGetConnectInfo, requestAndGetResponseInfo, requestAndGetUpgradeInfo} from './client';
import {getRequestInfo, getResponseInfo, responseInfoToBuffer} from './common';
import {handleConnect, handleUpgrade, startHttpServer} from './server';

export async function testRequestAndGetResponseInfo() {
  const {statusCode, data, headers} = await requestAndGetResponseInfo({
    url: 'http://elif.site/api/debug/:action',
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
}

export async function getSocketByConnect() {
  const {server, origin} = await startHttpServer({
    async request(req, rep) {
      throw new Error('should no go here');
    },
    connect(req, socket, head) {
      const {responseInfo} = handleConnect(req);
      socket.write(responseInfoToBuffer(responseInfo));
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
  const resInfo = await getResponseInfo(response);
  console.log(resInfo, head.toString());
  handleSocketEvents(socket, {color: 'green'});
  setTimeout(() => {
    writeDataByInterval(socket, {endStr: 'bye'});
  });
  server.close();
}

export async function getSocketByUpgrade() {
  const {server, origin} = await startHttpServer({
    async request(req, rep) {
      console.log(await getRequestInfo(req));
    },
    upgrade(req, socket, head) {
      const {responseInfo} = handleUpgrade(req, socket, head);
      socket.write(responseInfoToBuffer(responseInfo));
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
      Upgrade: 'websocket',
    },
  });
  handleSocketEvents(socket, {color: 'green'});
  setTimeout(() => {
    writeDataByInterval(socket, {endStr: 'bye'});
  });
  server.close();
}

export async function swithHttpToSocks() {
  const {origin} = await startHttpServer({
    async request(req, rep) {
      console.log(await getRequestInfo(req));
    },
    async upgrade(req, socket, head) {
      logWithColor('red', await getRequestInfo(req));
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
