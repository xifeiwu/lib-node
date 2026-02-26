import http from 'http';
import {HttpServerConfig, LogColors} from '../../types';
import {watchSocketState} from '../../net';
import {
  customResponseByRequest,
  getHttpRequestHeaderPartInfo,
  handleConnectEvent,
  response404,
  responseEmpty,
  responseHtml,
  responseHttpRequestInfo,
  responseServerEnv,
} from './service';
import {logColorful} from '../../log';
import {HttpDebugServerPath, listAUsingUl, toNormalizedUrlProps} from '../../external';
import {convertToBuffer} from '../../transform';
import {httpResponseInfoToBuffer} from '../tcp';
import {startHttpServer} from './server';

export function stopServer(response: http.ServerResponse) {
  response.statusCode = 302;
  response.setHeader('Location', '/');
  response.setHeader('content-type', 'text/plain; charset=utf-8');
  response.end(convertToBuffer(`Redirecting to <a href="/">index</a>.`));
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

const pathnameToHandler: {
  [key in HttpDebugServerPath]: {
    handler: (response: http.ServerResponse, request?: http.IncomingMessage) => void;
    desc?: string;
  };
} = {
  [HttpDebugServerPath.echo]: {handler: responseHttpRequestInfo, desc: 'echo content of request'},
  [HttpDebugServerPath.customResponse]: {
    handler: customResponseByRequest,
    desc: 'get customized response by config send from request',
  },
  [HttpDebugServerPath.env]: {handler: responseServerEnv, desc: 'get server env'},
  [HttpDebugServerPath.stop]: {handler: stopServer, desc: 'stop running of server'},
  [HttpDebugServerPath.empty]: {handler: responseEmpty},
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
