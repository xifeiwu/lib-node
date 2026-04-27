import http from 'http';
import type {Socket} from 'net';
import {requestAndGetResponseInfo} from '../external';
import {getAFreePort} from '../../../net';
import {createProxyServer} from './request.test';

/**
 * WebSocket proxy: verifies bidirectional WebSocket message forwarding.
 */
export async function testWebSocketProxy() {
  const targetPort = await getAFreePort();
  const targetHost = '127.0.0.1';
  const targetOrigin = `http://${targetHost}:${targetPort}`;
  const targetServer = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end();
  });
  let targetSocket: Socket | undefined;
  targetServer.on('upgrade', (req, socket, head) => {
    targetSocket = socket as Socket;
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' + 'Upgrade: websocket\r\n' + 'Connection: Upgrade\r\n' + '\r\n'
    );
    socket.on('data', data => {
      socket.write(`echo:${data.toString()}`);
    });
  });
  await new Promise<void>(resolve => targetServer.listen(targetPort, targetHost, resolve));

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    ws: true,
  });

  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proxyUrl = new URL(proxyOrigin);
      const req = http.request({
        hostname: proxyUrl.hostname,
        port: proxyUrl.port,
        path: '/ws',
        headers: {
          Connection: 'Upgrade',
          Upgrade: 'websocket',
        },
      });

      const timer = setTimeout(() => reject(new Error('ws timeout')), 3000);
      req.on('upgrade', (res, socket, head) => {
        socket.write('hello');
        socket.on('data', data => {
          clearTimeout(timer);
          const msg = data.toString();
          socket.destroy();
          resolve(msg);
        });
      });

      req.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
      req.end();
    });
    console.assert(result === 'echo:hello', `expected "echo:hello", got "${result}"`);
    console.log('[PASS] testWebSocketProxy');
  } finally {
    targetSocket?.destroy();
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * WebSocket proxy hooks: verifies request and response hooks are applied to upgrade flow.
 */
export async function testWebSocketProxyHooks() {
  const targetPort = await getAFreePort();
  const targetHost = '127.0.0.1';
  const targetOrigin = `http://${targetHost}:${targetPort}`;
  let targetUrl = '';
  const targetServer = http.createServer((req, res) => {
    res.statusCode = 404;
    res.end('not found');
  });
  let targetSocket: Socket | undefined;
  targetServer.on('upgrade', (req, socket, head) => {
    targetSocket = socket as Socket;
    targetUrl = req.url ?? '';
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        'x-target: yes\r\n' +
        '\r\n'
    );
    socket.on('data', data => {
      socket.write(`hook:${data.toString()}`);
    });
  });
  await new Promise<void>(resolve => targetServer.listen(targetPort, targetHost, resolve));

  let preProxyReqCalled = false;
  let postResToProxyCalled = false;
  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    ws: true,
    handleProxyRequestOptions(info) {
      info.pathname = '/rewritten';
      info.headers = {...info.headers, 'x-ws-hook': 'yes'};
      return info;
    },
    preProxyReq(status, {href}) {
      preProxyReqCalled = true;
      console.assert(
        status.requestInfo.proxy.pathname === '/rewritten',
        'proxy pathname should be rewritten'
      );
      console.assert(href.endsWith('/rewritten'), `expected href to end with /rewritten, got ${href}`);
    },
    postResToProxy(_response, headerPart) {
      postResToProxyCalled = true;
      console.assert(headerPart.statusCode === 101, `expected 101, got ${headerPart.statusCode}`);
    },
    handleResponseInfoToOrigin(info) {
      info.headers['x-ws-response-hook'] = 'yes';
      return info;
    },
  });

  try {
    const result = await new Promise<{message: string; headers: http.IncomingHttpHeaders}>(
      (resolve, reject) => {
        const proxyUrl = new URL(proxyOrigin);
        const req = http.request({
          hostname: proxyUrl.hostname,
          port: proxyUrl.port,
          path: '/ws',
          headers: {
            Connection: 'Upgrade',
            Upgrade: 'websocket',
          },
        });

        const timer = setTimeout(() => reject(new Error('ws hook timeout')), 3000);
        req.on('upgrade', (res, socket, head) => {
          socket.write('hello');
          socket.on('data', data => {
            clearTimeout(timer);
            const message = data.toString();
            socket.destroy();
            resolve({message, headers: res.headers});
          });
        });

        req.on('error', err => {
          clearTimeout(timer);
          reject(err);
        });
        req.end();
      }
    );

    console.assert(targetUrl === '/rewritten', `expected /rewritten, got "${targetUrl}"`);
    console.assert(preProxyReqCalled, 'preProxyReq should be called for websocket proxy');
    console.assert(postResToProxyCalled, 'postResToProxy should be called for websocket proxy');
    console.assert(
      result.headers['x-ws-response-hook'] === 'yes',
      'response hook header should be forwarded'
    );
    console.assert(result.message === 'hook:hello', `expected "hook:hello", got "${result.message}"`);
    console.log('[PASS] testWebSocketProxyHooks');
  } finally {
    targetSocket?.destroy();
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * Run all WebSocket proxy tests.
 */
export async function runAllWebSocketTests() {
  const tests = [testWebSocketProxy, testWebSocketProxyHooks];

  let passed = 0;
  let failed = 0;
  for (const test of tests) {
    try {
      await test();
      passed++;
    } catch (err) {
      failed++;
      console.error(`[FAIL] ${test.name}:`, (err as Error).message);
    }
  }
  console.log(`\nWebSocket tests: ${passed} passed, ${failed} failed, ${tests.length} total`);
}
