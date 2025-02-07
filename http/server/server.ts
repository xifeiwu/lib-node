import {Socket} from 'net';
import http, {RequestListener} from 'http';
import {IncomingMessage} from 'http';
import {HttpServerConfig, LogColors} from '../../types';
import {getAFreePort, watchSocketState} from '../../net';
import {httpResponseInfoToBuffer} from '../service';
import {getHttpRequestHeaderPartInfo, handleConnectEvent, responseHttpRequestInfo} from './receive';
import {logColorful} from '../../log';

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
  return {host, port, origin, server};
}
