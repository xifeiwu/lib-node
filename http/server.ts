import http, {RequestListener, ServerOptions} from 'http';
import {toBuffer} from '../transform';
import {createHash} from 'crypto';
import {IncomingHttpHeaders, IncomingMessage} from 'http';
import {Duplex} from 'stream';
import {
  HttpOutgoingHeaderPartProps,
  TcpHttpRequestProps,
  HttpRequestOptions,
  HttpResponseProps,
  getAFreePort,
  getRequestHeaderInfo,
  getRequestInfo,
} from '..';
import {Socket} from 'net';
import {deepEqual, UrlProps, toUrlProps, isNumber, waitFor} from '../external';

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
    connection?: (socket: Socket) => void;
  },
  config?: HttpServerConfig
) {
  const {request: handleRequest, upgrade: handleUpgrade, connect: handleConnect, connection: handleConnection} = handler;
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
    handleConnection && server.on('connection', handleConnection);
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
): {requestHeaderPartInfo: HttpOutgoingHeaderPartProps; responseInfo: HttpResponseProps} {
  const requestHeaderPartInfo = getRequestHeaderInfo(req);
  const key = requestHeaderPartInfo.headers['sec-websocket-key'];
  const digest = createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  const responseInfo: HttpResponseProps = {
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
): {requestHeaderPartInfo: TcpHttpRequestProps; responseInfo: HttpResponseProps} {
  const requestHeaderPartInfo = getRequestHeaderInfo(req);
  const responseInfo: HttpResponseProps = {
    httpVersion: 'HTTP/1.1',
    statusCode: 200,
    statusMessage: 'Connection Established',
  };
  return {requestHeaderPartInfo, responseInfo};
}

interface Action4IncomingMessage {
  waitInMs?: number;
}

export interface HttpConditionAndAction {
  requestConfig: Pick<HttpRequestOptions, 'method' | 'pathname' | 'query'>;
  action: Action4IncomingMessage;
}

/**
 * @returns Whether the request is handled by this function or not
 */
export async function handleIncomingMessage(
  httpStream: {request: http.IncomingMessage; response?: http.ServerResponse},
  configList?: HttpConditionAndAction[]
) {
  const {request, response} = httpStream;
  const {method, url} = getRequestHeaderInfo(request);
  const {pathname, query} = toUrlProps(url);
  if (!Array.isArray(configList)) {
    return false;
  }
  const matchedConfig = configList.find(config => {
    const {requestConfig} = config;
    if (requestConfig.method.toLowerCase() !== method.toLowerCase() || requestConfig.pathname !== pathname) {
      return false;
    }
    if (requestConfig.query) {
      return deepEqual(requestConfig.query, query);
    }
    return true;
  });
  if (!matchedConfig) {
    return false;
  }
  const {
    action: {waitInMs},
  } = matchedConfig;
  if (isNumber(waitInMs)) {
    await waitFor(waitInMs);
  }
  return false;
}
