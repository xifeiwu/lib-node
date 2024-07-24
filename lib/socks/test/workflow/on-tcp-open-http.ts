import {
  LogColors,
  getAFreePort,
  handleSocketEvents,
  logWithColor,
  requestAndGetResponseInfo,
  startSocketServer,
  writeDataByInterval,
} from '../../external';
import {runSocksServerOnSocket} from '../../server-on-socket';
import {getSocketInfo} from '../../service';
import {EMethod} from '../../service/types';
import {connectToSocksServer} from '../../service/client';
import assert from 'assert';

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
  const socksServerPort = await getAFreePort(targetServerInfo.port + 1);
  const httpServerPort = await getAFreePort(targetServerInfo.port + 2);
  const {socksService} = await runSocksServerOnSocket({
    httpServerConfig: {
      port: httpServerPort,
    },
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'bbb'}},
    ],
    serverConfig: {
      host,
      port: socksServerPort,
      options: {
        allowHalfOpen: true,
      },
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
  logWithColor(colors.socksServer, `socks server port: ${socksService.port}`);
  const clientStatus = await connectToSocksServer({
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'bbb'}},
    ],
    socketConfig: {host, port: socksServerPort, allowHalfOpen: true},
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
    url: `http://${socksService.host}:${socksService.port}/api/socks/connections`,
  });
  assert.equal(responseInfo.statusCode, 200);
  assert.equal(Array.isArray(responseInfo.data), true);
}
