import https from 'https';
import http, {IncomingMessage} from 'http';
import {Socket} from 'net';
import {HttpProxyConfig, ProxyStatus} from '../types';
import {logColorful} from '../external';
import {processProxyRequest, processProxyResponse, writeHttpResponseInfoToSocket} from './common';

export async function proxyWebSocketRequest(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  config: HttpProxyConfig
) {
  const {proxyTimeout} = config;

  const proxyStatus: ProxyStatus = {ts: Date.now()};
  const {proxyReqInfo, urlInst, requestOptions} = await processProxyRequest(req, config, {
    protocolType: 'ws',
    proxyStatus,
  });
  const {href, protocol} = urlInst;

  config.preProxyReq?.(proxyStatus, {href});

  const processOptions = {proxyReqInfo, proxyStatus, req, href};

  const proxyReq = (protocol === 'https:' || protocol === 'wss:' ? https : http).request(
    href,
    requestOptions
  );

  if (proxyTimeout) {
    proxyReq.setTimeout(proxyTimeout, () => {
      proxyReq.destroy();
      socket.end();
    });
  }

  proxyReq.on('error', err => {
    const error = err as NodeJS.ErrnoException;
    proxyStatus.err = {message: error.message, stack: error.stack, code: error.code};
    logColorful({color: 'red'}, `[ws proxy error] ${error.code || 'UNKNOWN'}: ${error.message}`);
    socket.end();
  });

  proxyReq.on('response', async res => {
    if (!res.headers.upgrade) {
      const {proxyResInfo} = await processProxyResponse(res, config, processOptions);
      writeHttpResponseInfoToSocket(socket, proxyResInfo);
      res.pipe(socket);
    }
  });

  proxyReq.on('upgrade', async (proxyRes, proxySocket, proxyHead) => {
    proxySocket.on('error', () => socket.end());
    socket.on('error', () => proxySocket.end());

    const {proxyResInfo} = await processProxyResponse(proxyRes, config, processOptions);
    writeHttpResponseInfoToSocket(socket, proxyResInfo);

    if (proxyHead && proxyHead.length) {
      socket.write(proxyHead);
    }

    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.end();

  if (head && head.length) {
    proxyReq.write(head);
  }

  socket.on('close', () => {
    if (!proxyReq.destroyed) {
      proxyReq.destroy();
    }
  });
}
