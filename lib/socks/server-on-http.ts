import {Socket} from 'net';
import {checkPort, upgradeProtocol} from './service';
import {HttpServerConfig} from './service/types';
import {startDebugServer} from '../koa';
import {getRequestInfo} from './external';
import {handleConnection} from './service/server';
import {exposeStatusByHttp} from './service/http-server';
import {handleCustomConnection} from './protocol-custom';
import {IncomingHttpHeaders} from 'http';

/**
 * used to catch error, such as:
 * node Error: read ECONNRESET
 */
process.on('uncaughtException', function(err) {
  console.log(err.stack);
  console.log('NOT exit...');
});

/**
 * Start a http server, can use http upgrade socket to run socks protocol.
 * @param config
 * @returns
 */
export async function runSocksServerOnHttp(config: HttpServerConfig) {
  const {cipher, methodList, serverConfig, onConnection, proxyAsSocketClientConfigList} = config;
  await checkPort(serverConfig.port);
  const {pushConnectStatus, koaMiddlewareList} = exposeStatusByHttp();
  const {port} = serverConfig ?? {};
  const handleConnectionFinal = cipher ? handleCustomConnection : handleConnection;
  /** Use authorized method first */
  methodList.sort((pre, next) => next.method - pre.method);
  const httpService = await startDebugServer([...koaMiddlewareList], {port});
  const {server} = httpService;
  server.on('upgrade', async (req, socket, head) => {
    const {headers} = await getRequestInfo(req);
    const upgrade = Object.entries(headers).reduce<IncomingHttpHeaders>((sum, [key, value]) => {
      sum[key.toLocaleLowerCase()] = value;
      return sum;
    }, {}).upgrade;
    if (upgrade !== upgradeProtocol) {
      socket.destroy();
      return;
    }
    socket.write(
      'HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
        `Upgrade: ${upgradeProtocol}\r\n` +
        'Connection: Upgrade\r\n' +
        '\r\n'
    );
    const connectStatus = await handleConnectionFinal(
      socket as Socket,
      methodList,
      proxyAsSocketClientConfigList
    );
    onConnection(connectStatus);
    pushConnectStatus(connectStatus);
  });
  return httpService;
}
