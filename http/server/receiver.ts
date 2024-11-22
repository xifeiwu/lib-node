import {Socket} from 'net';
import http, {RequestListener} from 'http';
import {fromBuffer, toBuffer} from '../../transform';
import {createHash} from 'crypto';
import {IncomingMessage} from 'http';
import {Duplex} from 'stream';
import {
  HttpRequestOptions,
  HttpResponseInfo,
  logColorful,
  watchSocketState,
  HttpServerConfig,
  LogColors,
  HttpRequestHeaderPartInfo,
  getIncomingMessageData,
} from '../../index';
import {HttpRequestInfo, CustomHandleRequestOptions, GetIncomingMessageHeader} from '../../types';
import {getAFreePort} from '../../net';
import {deepEqual, toUrlProps, isNumber, waitFor, toInteger} from '../../external';
import {httpResponseInfoToBuffer} from '../tcp';

export async function startHttpServer(
  handler: {
    request?: RequestListener;
    upgrade?: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
    connect?: (req: IncomingMessage, socket: Socket, head: Buffer) => void;
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

export const getHttpRequestHeaderPartInfo: GetIncomingMessageHeader<'server'> = (
  request: IncomingMessage
) => {
  const {method, url, httpVersion, headers} = request;
  return {method, url, httpVersion, headers};
};

export async function getHttpRequestInfo<DataType = any>(
  incomingMessage: http.IncomingMessage,
  options?: {
    maxLength?: number;
    dataType?: 'buffer' | 'string' | 'json';
  }
): Promise<HttpRequestInfo<DataType>> {
  const {maxLength = 32 * 1024 * 1024, dataType = 'json'} = options ?? {};
  let buffer = await getIncomingMessageData(incomingMessage);
  if (buffer.byteLength > maxLength) {
    buffer = buffer.subarray(0, maxLength);
  }
  const data = fromBuffer(buffer, dataType) as DataType;
  return {
    ...getHttpRequestHeaderPartInfo(incomingMessage),
    data,
  };
}
/**
 * response/echo requestInfo
 */
export async function responseHttpRequestInfo(request: http.IncomingMessage, response: http.ServerResponse) {
  const requestInfo = await getHttpRequestInfo(request);
  const resData = toBuffer(requestInfo);
  response.setHeader['content-length'] = resData.byteLength;
  response.setHeader['content-type'] = 'application/json';
  response.end(resData);
}

export interface HttpConditionAndAction {
  requestConfig: Pick<HttpRequestOptions, 'method' | 'pathname' | 'query'>;
  action: CustomHandleRequestOptions;
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
  const {method, url} = getHttpRequestHeaderPartInfo(request);
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
  await customHandleRequest(httpStream, matchedConfig.action);
  return false;
}

export async function customHandleRequest(
  httpStream: {request: http.IncomingMessage; response?: http.ServerResponse},
  config?: CustomHandleRequestOptions
) {
  const {response} = httpStream;
  const {delayMs, responseCode} = config ?? {};
  if (delayMs) {
    const delayInMs = parseInt(delayMs as string);
    !Number.isNaN(delayInMs) && (await waitFor(delayInMs));
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
          logColorful(
            {color: logRequestHeaderInfo},
            'headerPart Info:',
            getHttpRequestHeaderPartInfo(request)
          );
        logSocketState && watchSocketState(request.socket, {colorStyle: {color: 'yellow'}});
        responseHttpRequestInfo(request, response);
      },
      connect(req, socket, head) {
        const {responseInfo} = handleConnectEvent(req);
        socket.write(httpResponseInfoToBuffer(responseInfo));
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

export function getUpgradeProtocol(req: IncomingMessage) {
  const {upgrade, connection} = req.headers;
  if (connection.toLocaleLowerCase() !== 'upgrade') {
    throw new Error(`connection should be upgrade`);
  }
  if (upgrade === undefined) {
    throw new Error(`upgrade should be set`);
  }
  return upgrade;
}
export function getUpgradeResponse(protocol: string, info?: HttpResponseInfo) {
  const {headers, ...restInfo} = info ?? {};
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 101,
    statusMessage: 'Switching Protocols',
    headers: {
      Upgrade: protocol,
      Connection: 'Upgrade',
      ...(headers ?? {}),
    },
    ...(restInfo ?? {}),
  };
  return responseInfo;
}

export const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export function handleWebsocketUpgrade(
  req: IncomingMessage,
  socket?: Duplex,
  head?: Buffer
): HttpResponseInfo {
  const {headers} = req;
  if (headers === undefined) {
    throw new Error(`Not found headers`);
  }
  const key = headers['sec-websocket-key'];
  if (key === undefined) {
    throw new Error(`sec-websocket-key is not found on header part`);
  }
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
  return responseInfo;
}

/**
 * Default way of handle connect event
 */
export function handleConnectEvent(
  req: IncomingMessage,
  socket?: Duplex,
  head?: Buffer
): {requestHeaderPartInfo: HttpRequestHeaderPartInfo<'receiver'>; responseInfo: HttpResponseInfo} {
  const requestHeaderPartInfo = getHttpRequestHeaderPartInfo(req);
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 200,
    statusMessage: 'Connection Established',
  };
  return {requestHeaderPartInfo, responseInfo};
}
