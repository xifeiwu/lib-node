import {logWithColor} from '../log';
import {handleSocketEvents, writeDataByInterval} from '../net';
import {toBuffer} from '../transform';
import {requestAndGetConnectInfo, requestAndGetResponseInfo, requestAndGetUpgradeInfo} from './client';
import {getRequestInfo, getResponseInfo} from './common';
import {startHttpServer} from './server';

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
  const {origin} = await startHttpServer({
    async request(req, rep) {
      throw new Error('should no go here');
    },
    connect(req, socket, head) {
      socket.write(toBuffer(['HTTP/1.1 200 Success\r\n', '\r\n', head]));
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
}

export async function getSocketByUpgrade() {
  const {origin} = await startHttpServer({
    async request(req, rep) {
      console.log(await getRequestInfo(req));
    },
    upgrade(req, socket, head) {
      socket.write(
        'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
          'Upgrade: WebSocket\r\n' +
          'Connection: Upgrade\r\n' +
          '\r\n'
      );
      console.log('on upgrade');
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
}

export async function swithHttpToSocks() {
  const {origin} = await startHttpServer({
    async request(req, rep) {
      console.log(await getRequestInfo(req));
    },
    async upgrade(req, socket, head) {
      console.log('on upgrade');
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
