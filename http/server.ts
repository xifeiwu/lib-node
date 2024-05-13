import http, {RequestListener, ServerOptions} from 'http';
import {toBuffer} from '../transform';
import {createHash} from 'crypto';
import {IncomingHttpHeaders, IncomingMessage} from 'http';
import {Duplex} from 'stream';
import {
  HttpHeaderPartInfo,
  HttpRequestInfo,
  HttpResponseInfo,
  getAFreePort,
  getRequestHeaderInfo,
  getRequestInfo,
} from '..';
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

export interface HttpServerConfig {
  host?: string;
  port?: number;
  options?: ServerOptions;
}
export async function startHttpServer(
  handler: {
    request?: RequestListener;
    upgrade?: (response, socket: Socket, head: Buffer) => void;
    connect?: (response, socket: Socket, head: Buffer) => void;
  },
  config?: HttpServerConfig
) {
  const {request: handleRequest, upgrade: handleUpgrade, connect: handleConnect} = handler;
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
    handleConnect && server.on('connect', handleConnect);
    server.on('error', err => {
      rej(err);
    });
  });
}

export async function responseRequestInfo(request: http.IncomingMessage, response: http.ServerResponse) {
  const requestInfo = await getRequestInfo(request);
  const resData = toBuffer(requestInfo);
  response.setHeader['content-length'] = resData.byteLength;
  response.setHeader['content-type'] = 'application/json';
  response.end(resData);
}

export const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export function handleUpgrade(
  req: IncomingMessage,
  socket?: Duplex,
  head?: Buffer
): {requestHeaderPartInfo: HttpHeaderPartInfo; responseInfo: HttpResponseInfo} {
  const requestHeaderPartInfo = getRequestHeaderInfo(req);
  const key = requestHeaderPartInfo.headers['sec-websocket-key'];
  const digest = createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 101,
    statusMessage: 'Switching Protocols',
    headers: {
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Accept': digest,
    },
  };
  return {requestHeaderPartInfo, responseInfo};
}

export function handleConnect(
  req: IncomingMessage,
  socket?: Duplex,
  head?: Buffer
): {requestHeaderPartInfo: HttpRequestInfo; responseInfo: HttpResponseInfo} {
  const requestHeaderPartInfo = getRequestHeaderInfo(req);
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 200,
    statusMessage: 'Connection Established',
  };
  return {requestHeaderPartInfo, responseInfo};
}
