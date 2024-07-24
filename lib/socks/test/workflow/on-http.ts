import assert from 'assert';
import {
  LogColors,
  getAFreePort,
  handleSocketEvents,
  logWithColor,
  requestAndGetResponseInfo,
  startSocketServer,
  writeDataByInterval,
} from '../../external';
import {getSocketInfo} from '../../service';
import {EMethod} from '../../service/types';
import {connectToSocksServer} from '../../service/client';
import {runSocksServerOnHttp} from '../../server-on-http';

const colors: {
  targetServer: LogColors;
  socksServer: LogColors;
  socksClient: LogColors;
  inSocketOfSocks: LogColors;
  outSocketOfSocks: LogColors;
} = {
  targetServer: 'red',
  socksServer: 'yellow',
  socksClient: 'green',
  inSocketOfSocks: 'blue',
  outSocketOfSocks: 'magenta',
};

/**
 * Go through the basic work flow
 */
export async function start() {
  const targetServerInfo = await startSocketServer({}, socket => {
    logWithColor(colors.targetServer, 'socket connect:', getSocketInfo(socket));
    handleSocketEvents(socket, {isServer: true, color: colors.targetServer});
  });
  logWithColor(colors.targetServer, `target service port: ${targetServerInfo.port}`);
  const host = '127.0.0.1';
  const port = await getAFreePort(targetServerInfo.port + 1);
  const httpService = await runSocksServerOnHttp({
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'bbb'}},
    ],
    serverConfig: {
      host,
      port,
    },
    onConnection(status) {
      const {state, error, socket, socket2Service} = status;
      handleSocketEvents(socket, {isServer: false, color: colors.inSocketOfSocks});
      handleSocketEvents(socket2Service, {isServer: false, color: colors.outSocketOfSocks});
      logWithColor(
        colors.socksServer,
        'socks server connect status: ',
        state,
        error,
        getSocketInfo(socket),
        getSocketInfo(socket2Service)
      );
      // console.log(status);
    },
  });
  logWithColor(colors.socksServer, `socks server port: ${httpService.port}`);
  const clientStatus = await connectToSocksServer({
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'bbb'}},
    ],
    // socketConfig: {host, port, allowHalfOpen: true},
    httpUrl: httpService.url,
    targetServiceInfo: {
      address: targetServerInfo.host,
      port: targetServerInfo.port,
    },
  });
  if (clientStatus.error) {
    console.log(clientStatus.error);
  } else {
    handleSocketEvents(clientStatus.socket, {color: colors.socksClient});
    logWithColor(colors.socksClient, getSocketInfo(clientStatus.socket));
    await writeDataByInterval(clientStatus.socket, {
      startChar: 'b',
      endStr: 'bye',
      maxCount: 3,
    });
  }
  const responseInfo = await requestAndGetResponseInfo({
    url: `${httpService.url}/api/socks/connections`,
  });
  assert.equal(responseInfo.statusCode, 200);
  assert.equal(Array.isArray(responseInfo.data), true);
}
