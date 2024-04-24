import {logWithColor} from '../log';
import {handleSocketEvents, writeDataByInterval} from '../net';
import {requestAndGetResponseInfo, requestAndGetUpgradeInfo} from './client';
import {getRequestInfo} from './common';
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
