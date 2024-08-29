import http, {RequestListener, ServerOptions} from 'http';
import {toBuffer} from '../transform';
import {createHash} from 'crypto';
import {IncomingMessage} from 'http';
import {Duplex} from 'stream';
import {
  HttpHeaderPartProps,
  TcpHttpRequestProps,
  HttpRequestOptions,
  HttpResponseProps,
  getAFreePort,
  getRequestHeaderInfo,
  getRequestInfo,
  logColorful,
  watchSocketState,
  responseInfoToBuffer,
  HttpServerConfig,
  ColorStyle,
  LogColors,
} from '..';
import {Socket} from 'net';
import {deepEqual, toUrlProps, isNumber, waitFor} from '../external';
import {Action4IncomingMessage} from '../types';
import {toInteger} from '../../fe/utils';

export async function startHttpServer(
  handler: {
    request?: RequestListener;
    upgrade?: (response, socket: Socket, head: Buffer) => void;
    connect?: (response, socket: Socket, head: Buffer) => void;
    connection?: (socket: Socket) => void;
  },
  config?: HttpServerConfig
) {
  const {
    request: handleRequest,
    upgrade: handleUpgrade,
    connect: handleConnect,
    connection: handleConnection,
  } = handler;
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

/**
 * responsee/echo requestInfo
 */
export async function responseRequestEvent(request: http.IncomingMessage, response: http.ServerResponse) {
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
): {requestHeaderPartInfo: HttpHeaderPartProps<'Server'>; responseInfo: HttpResponseProps} {
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

/**
 * Default way of handle connect event
 */
export function handleConnectEvent(
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

export interface HttpConditionAndAction {
  requestConfig: Pick<HttpRequestOptions, 'method' | 'pathname' | 'query'>;
  action: Action4IncomingMessage;
}

/**
 * Do some actions by HttpConditionAndAction
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
  await handleIncomingMessageByConfig(httpStream, matchedConfig.action);
  return false;
}

export async function handleIncomingMessageByConfig(
  httpStream: {request: http.IncomingMessage; response?: http.ServerResponse},
  config?: Action4IncomingMessage
) {
  const {response} = httpStream;
  const {delay, responseCode} = config ?? {};
  if (delay) {
    const delayInMs = parseInt(delay as string);
    isNumber(delayInMs) && (await waitFor(delayInMs));
  }
  if (responseCode) {
    const code = toInteger(responseCode);
    if (isNumber(code)) {
      response.statusCode = code;
    }
  }
  return;
}
/**
 * It is a raw node http debug server, not depend on any third-party(like Koa).
 * Just echo reuqst, mainly for debug
 */
export async function startHttpDebugServer(
  config?: HttpServerConfig,
  options?: {logRequestHeaderInfo?: LogColors; logSocketState?: LogColors}
) {
  const {logRequestHeaderInfo, logSocketState} = options ?? {};
  const {host, port, origin, server} = await startHttpServer(
    {
      request(request, response) {
        logRequestHeaderInfo &&
          logColorful({color: logRequestHeaderInfo}, 'headerPart Info:', getRequestHeaderInfo(request));
        logSocketState && watchSocketState(request.socket, {colorStyle: {color: 'yellow'}});
        responseRequestEvent(request, response);
      },
      connect(req, socket, head) {
        const {responseInfo} = handleConnectEvent(req);
        socket.write(responseInfoToBuffer(responseInfo));
        // handleSocketEvents(socket, {isServer: true, color: 'red'});
        socket.on('end', () => {
          socket.end();
        });
      },
    },
    config
  );
  // server.on('connection', socket => {
  //   socket.on('data', chunk => {
  //     console.log(`chunk.toString()`);
  //     console.log(chunk.toString());
  //   });
  // });
  console.log(`start http server: ${origin}`);
  return {host, port, origin, server};
}
