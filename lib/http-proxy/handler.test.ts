import http from 'http';
import https from 'https';
import {getDataFromReadable} from '../../stream';
import {proxyHttpRequest, proxyWebSocketRequest} from './handler';
import {getHttpRequestHeaderPartInfo, requestAndGetResponseInfo, startHttpServer} from './external';
import {getAFreePort} from '../../net';
import {HttpProxyConfig} from './types';

/**
 * For handler2, req.readable is false
 */
export async function twoWayOfProxyPayload() {
  const handler1: http.RequestListener = (req, res) => {
    console.log(`req.readable`);
    console.log(req.readable);
    proxyHttpRequest(req, res, {
      globalRequestOptions: {
        origin: 'http://elif.site',
      },
      handleResponseInfoToOrigin(info) {
        const {headers} = info;
        headers.handler = 'handler1';
        return info;
      },
    });
  };
  const handler2: http.RequestListener = async (req, res) => {
    const data = await getDataFromReadable(req);
    console.log(`req.readable`);
    console.log(req.readable);
    proxyHttpRequest(req, res, {
      originData: data,
      globalRequestOptions: {
        origin: 'http://elif.site',
      },
      handleResponseInfoToOrigin(info) {
        const {headers} = info;
        headers.handler = 'handler2';
        return info;
      },
    });
  };
  const {origin} = await new Promise<{origin: string}>(async (res, rej) => {
    const host = '0.0.0.0';
    const port = await getAFreePort();
    const origin = `http://${host}:${port}`;
    const server = http.createServer();
    server.listen(port, host);
    server.on('listening', () => {
      res({origin});
    });
    server.on('request', (req, res) => {
      const {headers} = getHttpRequestHeaderPartInfo(req);
      const {handler = '2'} = headers;
      if (handler === '2') {
        return handler2(req, res);
      }
      handler1(req, res);
    });
    server.on('error', err => {
      rej(err);
    });
  });
  console.log(`listening on ${origin}`);

  const resInfo1 = await requestAndGetResponseInfo({
    url: `${origin}/api/debug/echo`,
    headers: {
      handler: '1',
    },
  });
  console.log(resInfo1);
  const resInfo2 = await requestAndGetResponseInfo({
    url: `${origin}/api/debug/echo`,
    headers: {
      handler: '2',
    },
  });
  console.log(resInfo2);
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

function createProxyServer(config: HttpProxyConfig): Promise<{origin: string; server: http.Server}> {
  return new Promise(async (resolve, reject) => {
    const port = await getAFreePort();
    const host = '127.0.0.1';
    const server = http.createServer((req, res) => {
      proxyHttpRequest(req, res, config);
    });
    if (config.ws) {
      server.on('upgrade', (req, socket, head) => {
        proxyWebSocketRequest(req, socket, head, config);
      });
    }
    server.listen(port, host, () => resolve({origin: `http://${host}:${port}`, server}));
    server.on('error', reject);
  });
}

/**
 * Basic proxy: forwards GET request and returns target's response body and status.
 */
export async function testBasicProxy() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({method: req.method, url: req.url}));
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/api/test`});
    const {statusCode, data} = responseInfo;
    console.assert(statusCode === 200, `expected 200, got ${statusCode}`);
    console.assert(data.method === 'GET', `expected GET, got ${data.method}`);
    console.assert(data.url === '/api/test', `expected /api/test, got ${data.url}`);
    console.log('[PASS] testBasicProxy');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * POST with JSON body: verifies request body is forwarded correctly.
 */
export async function testPostWithBody() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer(async (req, res) => {
    const body = await getDataFromReadable(req);
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({method: req.method, body: JSON.parse(body.toString())}));
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
  });

  try {
    const payload = {name: 'test', value: 42};
    const {responseInfo} = await requestAndGetResponseInfo({
      url: `${proxyOrigin}/api/data`,
      method: 'POST',
      data: payload,
    });
    console.assert(responseInfo.statusCode === 200, `expected 200`);
    console.assert(responseInfo.data.method === 'POST', `expected POST`);
    console.assert(responseInfo.data.body.name === 'test', `expected body.name=test`);
    console.assert(responseInfo.data.body.value === 42, `expected body.value=42`);
    console.log('[PASS] testPostWithBody');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * xfwd: verifies x-forwarded-* headers are added.
 */
export async function testXForwardedHeaders() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-forwarded-port': req.headers['x-forwarded-port'],
        'x-forwarded-proto': req.headers['x-forwarded-proto'],
        'x-forwarded-host': req.headers['x-forwarded-host'],
      })
    );
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    xfwd: true,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    const {data} = responseInfo;
    console.assert(data['x-forwarded-for'] !== undefined, 'x-forwarded-for should be set');
    console.assert(data['x-forwarded-port'] !== undefined, 'x-forwarded-port should be set');
    console.assert(
      data['x-forwarded-proto'] === 'http',
      `expected proto=http, got ${data['x-forwarded-proto']}`
    );
    console.assert(data['x-forwarded-host'] !== undefined, 'x-forwarded-host should be set');
    console.log('[PASS] testXForwardedHeaders');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * changeOrigin: verifies Host header is rewritten to target.
 */
export async function testChangeOrigin() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({host: req.headers.host}));
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    changeOrigin: true,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    const targetHost = new URL(targetOrigin).host;
    console.assert(
      responseInfo.data.host === targetHost,
      `expected host=${targetHost}, got ${responseInfo.data.host}`
    );
    console.log('[PASS] testChangeOrigin');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * handleProxyRequestOptions: verifies async hook can modify request.
 */
export async function testHandleProxyRequestOptions() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({customHeader: req.headers['x-custom']}));
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    async handleProxyRequestOptions(info) {
      info.headers = {...info.headers, 'x-custom': 'injected-value'};
      return info;
    },
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(responseInfo.data.customHeader === 'injected-value', `expected injected-value`);
    console.log('[PASS] testHandleProxyRequestOptions');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * handleResponseInfoToOrigin: verifies async hook can modify response headers.
 */
export async function testHandleResponseInfoToOrigin() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    async handleResponseInfoToOrigin(info) {
      info.headers['x-proxy-added'] = 'yes';
      return info;
    },
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(responseInfo.headers['x-proxy-added'] === 'yes', 'expected x-proxy-added header');
    console.log('[PASS] testHandleResponseInfoToOrigin');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * Target returns 502: verifies error status is forwarded.
 */
export async function testTargetErrorStatus() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 503;
    res.statusMessage = 'Service Unavailable';
    res.end('down');
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(responseInfo.statusCode === 503, `expected 503, got ${responseInfo.statusCode}`);
    console.log('[PASS] testTargetErrorStatus');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * Target unreachable: verifies proxy returns 502 ECONNREFUSED.
 */
export async function testTargetUnreachable() {
  const freePort = await getAFreePort();
  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: `http://127.0.0.1:${freePort}`},
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(responseInfo.statusCode === 502, `expected 502, got ${responseInfo.statusCode}`);
    console.log('[PASS] testTargetUnreachable');
  } finally {
    proxyServer.close();
  }
}

/**
 * proxyTimeout: verifies proxy returns error when target is too slow.
 */
export async function testProxyTimeout() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    setTimeout(() => {
      res.statusCode = 200;
      res.end('slow');
    }, 3000);
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    proxyTimeout: 200,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(
      responseInfo.statusCode === 500,
      `expected 500 on timeout, got ${responseInfo.statusCode}`
    );
    console.log('[PASS] testProxyTimeout');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * cookieDomainRewrite: verifies Set-Cookie domain is rewritten.
 */
export async function testCookieDomainRewrite() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('set-cookie', 'sid=abc123; path=/; domain=.target.com');
    res.end('ok');
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    cookieDomainRewrite: 'localhost',
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    const cookie = responseInfo.headers['set-cookie'];
    const cookieStr = Array.isArray(cookie) ? cookie[0] : cookie;
    console.assert(cookieStr.includes('domain=localhost'), `expected domain=localhost in "${cookieStr}"`);
    console.assert(!cookieStr.includes('.target.com'), `should not contain .target.com`);
    console.log('[PASS] testCookieDomainRewrite');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * hostRewrite: verifies Location header is rewritten on 302 redirect.
 */
export async function testHostRewrite() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 302;
    res.setHeader('location', 'http://target.internal:8080/login');
    res.end();
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    hostRewrite: 'my-proxy.com:3000',
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(responseInfo.statusCode === 302, `expected 302`);
    const location = responseInfo.headers.location as string;
    console.assert(location.includes('my-proxy.com:3000'), `expected rewritten host, got "${location}"`);
    console.assert(!location.includes('target.internal'), `should not contain target.internal`);
    console.log('[PASS] testHostRewrite');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * protocolRewrite: verifies Location header protocol is rewritten.
 */
export async function testProtocolRewrite() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 301;
    res.setHeader('location', `http://example.com/new-path`);
    res.end();
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    protocolRewrite: 'https',
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/old`});
    const location = responseInfo.headers.location as string;
    console.assert(location.startsWith('https://'), `expected https://, got "${location}"`);
    console.log('[PASS] testProtocolRewrite');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * prependPath: verifies target pathname is prepended to request path.
 */
export async function testPrependPath() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({url: req.url}));
  });

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin, pathname: '/api/v1'},
    prependPath: true,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/users`});
    console.assert(
      responseInfo.data.url.startsWith('/api/v1/users'),
      `expected /api/v1/users, got "${responseInfo.data.url}"`
    );
    console.log('[PASS] testPrependPath');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * followRedirects: verifies proxy follows 302 chain and returns final response.
 */
export async function testFollowRedirects() {
  const targetPort = await getAFreePort();
  const targetHost = '127.0.0.1';
  const targetOrigin = `http://${targetHost}:${targetPort}`;
  const targetServer = http.createServer((req, res) => {
    if (req.url === '/step1') {
      res.statusCode = 302;
      res.setHeader('location', `${targetOrigin}/step2`);
      res.end();
    } else if (req.url === '/step2') {
      res.statusCode = 302;
      res.setHeader('location', `${targetOrigin}/final`);
      res.end();
    } else if (req.url === '/final') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({reached: 'final'}));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>(resolve => targetServer.listen(targetPort, targetHost, resolve));

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    followRedirects: true,
    maxRedirects: 5,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/step1`});
    console.assert(responseInfo.statusCode === 200, `expected 200, got ${responseInfo.statusCode}`);
    console.assert(responseInfo.data.reached === 'final', `expected reached=final`);
    console.log('[PASS] testFollowRedirects');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * followRedirects with maxRedirects exceeded: verifies proxy returns 502.
 */
export async function testFollowRedirectsMaxExceeded() {
  const targetPort = await getAFreePort();
  const targetHost = '127.0.0.1';
  const targetOrigin = `http://${targetHost}:${targetPort}`;
  let counter = 0;
  const targetServer = http.createServer((req, res) => {
    counter++;
    res.statusCode = 302;
    res.setHeader('location', `${targetOrigin}/loop-${counter}`);
    res.end();
  });
  await new Promise<void>(resolve => targetServer.listen(targetPort, targetHost, resolve));

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    followRedirects: true,
    maxRedirects: 3,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({url: `${proxyOrigin}/start`});
    console.assert(responseInfo.statusCode === 502, `expected 502, got ${responseInfo.statusCode}`);
    console.log('[PASS] testFollowRedirectsMaxExceeded');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * followRedirects 303: verifies POST is converted to GET on 303 redirect.
 */
export async function testFollowRedirects303ToGet() {
  const targetPort = await getAFreePort();
  const targetHost = '127.0.0.1';
  const targetOrigin = `http://${targetHost}:${targetPort}`;
  const targetServer = http.createServer((req, res) => {
    if (req.url === '/submit') {
      res.statusCode = 303;
      res.setHeader('location', `${targetOrigin}/result`);
      res.end();
    } else if (req.url === '/result') {
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({method: req.method}));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise<void>(resolve => targetServer.listen(targetPort, targetHost, resolve));

  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    followRedirects: true,
  });

  try {
    const {responseInfo} = await requestAndGetResponseInfo({
      url: `${proxyOrigin}/submit`,
      method: 'POST',
      data: {form: 'data'},
    });
    console.assert(responseInfo.statusCode === 200, `expected 200, got ${responseInfo.statusCode}`);
    console.assert(
      responseInfo.data.method === 'GET',
      `expected GET after 303, got ${responseInfo.data.method}`
    );
    console.log('[PASS] testFollowRedirects303ToGet');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

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
  targetServer.on('upgrade', (req, socket, head) => {
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

      req.on('upgrade', (res, socket, head) => {
        socket.write('hello');
        socket.on('data', data => {
          const msg = data.toString();
          socket.end();
          resolve(msg);
        });
      });

      req.on('error', reject);
      setTimeout(() => reject(new Error('ws timeout')), 3000);
      req.end();
    });
    console.assert(result === 'echo:hello', `expected "echo:hello", got "${result}"`);
    console.log('[PASS] testWebSocketProxy');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * onRes2Proxy callback: verifies it is called with correct info.
 */
export async function testOnRes2ProxyCallback() {
  const {origin: targetOrigin, server: targetServer} = await createTargetServer((req, res) => {
    res.statusCode = 200;
    res.end('ok');
  });

  let callbackCalled = false;
  let capturedStatus: number | undefined;
  const {origin: proxyOrigin, server: proxyServer} = await createProxyServer({
    globalRequestOptions: {origin: targetOrigin},
    onRes2Proxy(info) {
      callbackCalled = true;
      capturedStatus = info.statusCode;
    },
  });

  try {
    await requestAndGetResponseInfo({url: `${proxyOrigin}/test`});
    console.assert(callbackCalled, 'onRes2Proxy should be called');
    console.assert(capturedStatus === 200, `expected status 200, got ${capturedStatus}`);
    console.log('[PASS] testOnRes2ProxyCallback');
  } finally {
    targetServer.close();
    proxyServer.close();
  }
}

/**
 * Run all handler tests.
 */
export async function runAllHandlerTests() {
  const tests = [
    testBasicProxy,
    testPostWithBody,
    testXForwardedHeaders,
    testChangeOrigin,
    testHandleProxyRequestOptions,
    testHandleResponseInfoToOrigin,
    testTargetErrorStatus,
    testTargetUnreachable,
    testProxyTimeout,
    testCookieDomainRewrite,
    testHostRewrite,
    testProtocolRewrite,
    testPrependPath,
    testFollowRedirects,
    testFollowRedirectsMaxExceeded,
    testFollowRedirects303ToGet,
    testWebSocketProxy,
    testOnRes2ProxyCallback,
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
  console.log(`\nHandler tests: ${passed} passed, ${failed} failed, ${tests.length} total`);
}
