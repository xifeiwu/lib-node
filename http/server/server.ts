import {Socket} from 'net';
import http, {RequestListener, ServerOptions} from 'http';
import https from 'https';
import {IncomingMessage} from 'http';
import {HttpServerConfig, LogColors} from '../../types';
import {getAFreePort, isOverTls, watchSocketState} from '../../net';
import {getHttpRequestHeaderPartInfo, handleConnectEvent} from './service';
import {
  customResponseByRequest,
  response404,
  responseEmpty,
  responseHtml,
  responseHttpRequestInfo,
} from './utils';
import {logColorful} from '../../log';
import {listAUsingUl, toNormalizedUrlProps, unifyNull} from '../../external';
import {httpResponseInfoToBuffer} from '../tcp';

function createServer(options: HttpServerConfig['options']) {
  if (isOverTls(options)) {
    return https.createServer(options);
  } else {
    return http.createServer(options as ServerOptions);
  }
}
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
  return new Promise<{
    origin: string;
    host: string;
    port: number;
    server: http.Server;
  }>((res, rej) => {
    const server = createServer(options).listen(port, host);
    const origin = `${isOverTls(options) ? 'https' : 'http'}://${host}:${port}`;
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

export enum DebugServerPathname {
  echo = '/api/echo',
  customResponse = '/api/custom-response',
  empty = '/api/empty',
}

const pathnameToHandler: {
  [key in DebugServerPathname]: (request: http.IncomingMessage, response: http.ServerResponse) => void;
} = {
  [DebugServerPathname.echo]: responseHttpRequestInfo,
  [DebugServerPathname.customResponse]: customResponseByRequest,
  [DebugServerPathname.empty]: responseEmpty,
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
    infoList: Object.entries(DebugServerPathname).map(([key, value]) => {
      return {
        href: value,
        text: value,
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
          const func = pathnameToHandler[pathname] ?? response404;
          func(request, response);
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
