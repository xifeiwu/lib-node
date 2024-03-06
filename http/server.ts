import http, {RequestListener, ServerOptions} from 'http';
import {toBuffer} from '../transform';
import {getAFreePort, getRequestInfo} from '..';
import {Socket} from 'net';

export async function responseIncomingMessageInfo(
  request: http.IncomingMessage,
  response: http.ServerResponse
) {
  const data = await getRequestInfo(request);
  const buffer = await toBuffer(data);
  const headers = {
    'content-type': 'application/json',
    'content-length': buffer.length,
  };
  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
  response.end(buffer);
}

export async function startHttpServer(
  handler: {
    request?: RequestListener;
    upgrade?: (req, socket: Socket, head: Buffer) => void;
  },
  config?: {
    host?: string;
    port?: number;
    options?: ServerOptions;
  }
) {
  const {request: handleRequest, upgrade: handleUpgrade} = handler;
  const {host = '0.0.0.0', port = await getAFreePort(), options} = config ?? {};
  const origin = `http://${host}:${port}`;
  return new Promise<{
    origin: string;
    host: string;
    port: number;
    server: http.Server;
  }>((res, rej) => {
    const server = http.createServer(options).listen(port, host);
    server.on('listening', () => {
      res({host, port, origin, server});
    });
    handleRequest && server.on('request', handleRequest);
    handleUpgrade && server.on('upgrade', handleUpgrade);
    server.on('error', err => {
      rej(err);
    });
  });
}
