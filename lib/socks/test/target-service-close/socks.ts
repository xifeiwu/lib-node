import {getAFreePort, handleSocketEvents, logWithColor, writeDataByInterval} from '../../external';
import {runSocksServerOnSocket} from '../../server-on-socket';
import {getSocketInfo} from '../../service';
import {EMethod} from '../../service/types';
import {connectToSocksServer} from '../../service/client';
import {colors, targetServerInfo} from './utils';

export async function start() {
  const host = '127.0.0.1';
  const port = await getAFreePort(targetServerInfo.port + 1);
  const {socksService} = await runSocksServerOnSocket({
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'bbb'}},
    ],
    serverConfig: {
      host,
      port,
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
    socketConfig: {host, port, allowHalfOpen: true},
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
    writeDataByInterval(clientStatus.socket, {
      startChar: 'b',
      endStr: 'bye',
      maxCount: 10,
      interval: 800,
    });
  }
}

start();
