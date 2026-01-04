import {Socket} from 'net';
import http, {RequestListener} from 'http';
import https from 'https';
import {IncomingMessage} from 'http';
import {HttpServerConfig, HttpsServerConfig, LogColors} from '../../types';
import {getAFreePort, isOverTls, watchSocketState} from '../../net';
import {getHttpRequestHeaderPartInfo, handleConnectEvent} from './service';
import {
  customResponseByRequest,
  stopServer,
  response404,
  responseEmpty,
  responseHtml,
  responseHttpRequestInfo,
  responseServerEnv,
} from './utils';
import {logColorful} from '../../log';
import {listAUsingUl, toNormalizedUrlProps} from '../../external';
import {httpResponseInfoToBuffer} from '../tcp';

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

export enum DebugServerPathname {
  echo = '/api/echo',
  customResponse = '/api/custom-response',
  empty = '/api/empty',
  env = '/api/env',
  stop = '/api/stop',
}

const pathnameToHandler: {
  [key in DebugServerPathname]: {
    handler: (response: http.ServerResponse, request?: http.IncomingMessage) => void;
    desc?: string;
  };
} = {
  [DebugServerPathname.echo]: {handler: responseHttpRequestInfo, desc: 'echo content of request'},
  [DebugServerPathname.customResponse]: {
    handler: customResponseByRequest,
    desc: 'get customized response by config send from request',
  },
  [DebugServerPathname.env]: {handler: responseServerEnv, desc: 'get server env'},
  [DebugServerPathname.stop]: {handler: stopServer, desc: 'stop running of server'},
  [DebugServerPathname.empty]: {handler: responseEmpty},
};
/**
 * It is a raw node http debug server, not depend on any third-party(like Koa), it handle pathname in two ways:
 * 1. DebugServerPathname.customResponse, can custom response by config from client side.
 * 2. For other pathname, echo request info.
 */
export async function startHttpDebugServer(
  config?: HttpServerConfig,
  options?: {logRequestHeaderInfo?: LogColors; logSocketState?: LogColors}
) {
  const {logRequestHeaderInfo, logSocketState} = options ?? {};
  const apiListHtml = listAUsingUl({
    infoList: Object.entries(pathnameToHandler).map(([pathname, value]) => {
      const {desc} = value;
      return {
        href: pathname,
        text: pathname,
        desc,
      };
    }),
  });

  const {host, port, origin, server} = await startHttpServer(
    {
      async request(request, response) {
        logRequestHeaderInfo &&
          logColorful(
            {color: logRequestHeaderInfo},
            'headerPart Info:',
            getHttpRequestHeaderPartInfo(request)
          );
        logSocketState && watchSocketState(request.socket, {colorStyle: {color: 'yellow'}});
        const {pathname} = toNormalizedUrlProps(request.url);
        if (pathname === '/') {
          responseHtml(response, apiListHtml);
        } else {
          const func = pathnameToHandler[pathname]?.handler ?? response404;
          func(response, request);
        }
      },
      async connect(req, socket, head) {
        const {responseInfo} = handleConnectEvent(req);
        socket.write(await httpResponseInfoToBuffer(responseInfo));
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
  return {host, port, origin, server, config};
}
