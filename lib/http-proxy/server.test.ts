import http from 'http';
import {PATHNAME_PROXY_STATUS, startProxyServer} from '.';
import {HttpProxyConfig} from './types';
import {requestAndGetResponseInfo, waitFor} from './external';
import {getAFreePort} from '../../net';
import {getDataFromReadable} from '../../stream';

export async function proxyToBaidu() {
  const config: HttpProxyConfig = {
    globalRequestOptions: {
      origin: 'https://www.baidu.com',
    },
    handleProxyRequestOptions(reqInfo) {
      console.log(`reqInfo`);
      console.log(reqInfo);
    },
    handleResponseInfoToOrigin(resInfo) {
      console.log(`resInfo`);
      console.log(resInfo);
    },
  };
  const {origin, server} = await startProxyServer(config);
  console.log(origin);
  await waitFor(10000);
  const {
    responseInfo: {data: proxyStatusList},
  } = await requestAndGetResponseInfo({
    url: origin + PATHNAME_PROXY_STATUS,
  });
  console.log(proxyStatusList);
}

/** Web browser can not connect to this server by https protocol, and will show error message: ERR_SSL_PROTOCOL_ERROR */
export async function test443Port() {
  await startProxyServer(
    {
      globalRequestOptions: {
        origin: 'http://elif.site',
      },
    },
    {port: 443}
  );
}

function createTargetServer(handler: http.RequestListener): Promise<{origin: string; server: http.Server}> {
  return new Promise(async (resolve, reject) => {
    const port = await getAFreePort();
    const host = '127.0.0.1';
    const server = http.createServer(handler);
    server.listen(port, host, () => resolve({origin: `http://${host}:${port}`, server}));
    server.on('error', reject);
  });
}

/**
 * startProxyServer: verifies proxy forwards requests and /api/proxy-status returns history.
 */
export async function testProxyServerWithStatus() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({url: req.url}));
  });

  const {origin: proxyOrigin, server: proxyServer} = await startProxyServer({
    globalRequestOptions: {origin: targetOrigin},
  });

  try {
    const {responseInfo: r1} = await requestAndGetResponseInfo({url: `${proxyOrigin}/first`});
    console.assert(r1.statusCode === 200, `expected 200`);
    console.assert(r1.data.url === '/first', `expected /first`);

    const {responseInfo: r2} = await requestAndGetResponseInfo({url: `${proxyOrigin}/second`});
    console.assert(r2.statusCode === 200, `expected 200`);

    const {responseInfo: statusRes} = await requestAndGetResponseInfo({
      url: `${proxyOrigin}${PATHNAME_PROXY_STATUS}`,
    });
    console.assert(statusRes.statusCode === 200, `status endpoint should return 200`);
    const statusList = statusRes.data;
    console.assert(Array.isArray(statusList), 'status should be an array');
    console.assert(statusList.length === 2, `expected 2 entries, got ${statusList.length}`);
    console.log('[PASS] testProxyServerWithStatus');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * /api/proxy-status?id=: verifies filtering by status ID.
 */
export async function testProxyStatusFilterById() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });

  const {origin: proxyOrigin, server: proxyServer} = await startProxyServer({
    globalRequestOptions: {origin: targetOrigin},
  });

  try {
    await requestAndGetResponseInfo({url: `${proxyOrigin}/req1`});
    await requestAndGetResponseInfo({url: `${proxyOrigin}/req2`});

    const {responseInfo: allStatus} = await requestAndGetResponseInfo({
      url: `${proxyOrigin}${PATHNAME_PROXY_STATUS}`,
    });
    const firstId = allStatus.data[0].id;

    const {responseInfo: filtered} = await requestAndGetResponseInfo({
      url: `${proxyOrigin}${PATHNAME_PROXY_STATUS}?id=${encodeURIComponent(firstId)}`,
    });
    console.assert(filtered.data !== undefined, 'filtered result should exist');
    console.assert(filtered.data.id === firstId, `expected id=${firstId}`);
    console.log('[PASS] testProxyStatusFilterById');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * startProxyServer with hooks: verifies handleProxyRequestOptions and handleResponseInfoToOrigin are invoked.
 */
export async function testProxyServerHooks() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({injected: req.headers['x-injected']}));
  });

  let reqHookCalled = false;
  let resHookCalled = false;

  const {origin: proxyOrigin, server: proxyServer} = await startProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    handleProxyRequestOptions(info) {
      reqHookCalled = true;
      info.headers = {...info.headers, 'x-injected': 'from-hook'};
      return info;
    },
    handleResponseInfoToOrigin(info) {
      resHookCalled = true;
      info.headers['x-modified'] = 'yes';
      return info;
    },
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(reqHookCalled, 'request hook should be called');
    console.assert(resHookCalled, 'response hook should be called');
    console.assert(responseInfo.data.injected === 'from-hook', 'request header should be injected');
    console.assert(responseInfo.headers['x-modified'] === 'yes', 'response header should be modified');
    console.log('[PASS] testProxyServerHooks');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * startProxyServer with ws: verifies WebSocket upgrade is proxied.
 */
export async function testProxyServerWebSocket() {
  const targetPort = await getAFreePort();
  const targetHost = '127.0.0.1';
  const targetOrigin = `http://${targetHost}:${targetPort}`;
  const targetServer = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end();
  });
  targetServer.on('upgrade', (req, socket, head) => {
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' + 'Upgrade: websocket\r\n' + 'Connection: Upgrade\r\n' + '\r\n'
    );
    socket.on('data', data => {
      socket.write(`ws-echo:${data.toString()}`);
    });
  });
  await new Promise<void>(resolve => targetServer.listen(targetPort, targetHost, resolve));

  const {origin: proxyOrigin, server: proxyServer} = await startProxyServer(
    {globalRequestOptions: {origin: targetOrigin}},
    {ws: true}
  );

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

      req.on('upgrade', (res, socket, head) => {
        socket.write('ping');
        socket.on('data', data => {
          socket.end();
          resolve(data.toString());
        });
      });

      req.on('error', reject);
      setTimeout(() => reject(new Error('ws timeout')), 3000);
      req.end();
    });

    console.assert(result === 'ws-echo:ping', `expected "ws-echo:ping", got "${result}"`);

    const {responseInfo: r1} = await requestAndGetResponseInfo({url: `${proxyOrigin}/http-test`});
    console.assert(r1.statusCode === 200, 'HTTP request should still work alongside WS');
    console.log('[PASS] testProxyServerWebSocket');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * startProxyServer with target error: verifies error is recorded in proxy status.
 */
export async function testProxyServerErrorInStatus() {
  const freePort = await getAFreePort();
  const {origin: proxyOrigin, server: proxyServer} = await startProxyServer({
    globalRequestOptions: {origin: `http://127.0.0.1:${freePort}`},
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/fail`});
    console.assert(responseInfo.statusCode === 502, `expected 502, got ${responseInfo.statusCode}`);

    const {responseInfo: statusRes} = await requestAndGetResponseInfo({
      url: `${proxyOrigin}${PATHNAME_PROXY_STATUS}`,
    });
    const statusList = statusRes.data;
    console.assert(statusList.length === 1, `expected 1 status entry`);
    console.assert(statusList[0].err !== undefined, 'status should have error info');
    console.assert(
      statusList[0].err.code === 'ECONNREFUSED',
      `expected ECONNREFUSED, got ${statusList[0].err.code}`
    );
    console.log('[PASS] testProxyServerErrorInStatus');
  } finally {
    proxyServer.close();
  }
}

/**
 * Run all server tests.
 */
export async function runAllServerTests() {
  const tests = [
    testProxyServerWithStatus,
    testProxyStatusFilterById,
    testProxyServerHooks,
    testProxyServerWebSocket,
    testProxyServerErrorInStatus,
  ];

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
  console.log(`\nServer tests: ${passed} passed, ${failed} failed, ${tests.length} total`);
}
