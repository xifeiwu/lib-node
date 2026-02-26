import {Socket} from 'net';
import http, {RequestListener} from 'http';
import https from 'https';
import {IncomingMessage} from 'http';
import {HttpServerConfig, HttpsServerConfig} from '../../types';
import {getAFreePort} from '../../net';

interface ServerHandler {
  request?: RequestListener;
  upgrade?: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
  connect?: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
  connection?: (socket: Socket) => void;
}

function wrapServer(server: http.Server | https.Server, handler: ServerHandler) {
  const {
    request: handleRequest,
    upgrade: handleUpgrade,
    connect: handleConnect,
    connection: handleConnection,
  } = handler;
  return new Promise<boolean>((res, rej) => {
    try {
      server.on('listening', () => {
        res(true);
      });
      handleConnection && server.on('connection', handleConnection);
      handleRequest && server.on('request', handleRequest);
      handleUpgrade && server.on('upgrade', handleUpgrade);
      handleConnect && server.on('connect', handleConnect);
      server.on('error', err => {
        rej(err);
      });
    } catch (err) {
      rej(err);
    }
  });
}

export async function startHttpServer(
  handler: ServerHandler,
  config?: HttpServerConfig
): Promise<{
  origin: string;
  host: string;
  port: number;
  server: http.Server;
}> {
  const {host = '0.0.0.0', port = await getAFreePort(), options} = config ?? {};
  const server = http.createServer(options).listen(port, host);
  await wrapServer(server, handler);
  const origin = `http://${host}:${port}`;
  return {
    host,
    port,
    origin,
    server,
  };
}
export async function startHttpsServer(
  handler: ServerHandler,
  config?: HttpsServerConfig
): Promise<{
  origin: string;
  host: string;
  port: number;
  server: https.Server;
}> {
  const {host = '0.0.0.0', port = await getAFreePort(), options} = config ?? {};
  const server = https.createServer(options).listen(port, host);
  await wrapServer(server, handler);
  const origin = `https://${host}:${port}`;
  return {
    host,
    port,
    origin,
    server,
  };
}
