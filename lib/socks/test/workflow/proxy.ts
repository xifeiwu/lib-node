import {
  LogColors,
  handleSocketEvents,
  logWithColor,
  startSocketServer,
  toBuffer,
  writeDataByInterval,
} from '../../external';
import {runSocksServerOnSocket} from '../../server-on-socket';
import {getSocketInfo} from '../../service';
import {EMethod} from '../../service/types';
import {connectToSocksServer} from '../../service/client';

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
const ports = {
  targetServer1: 3300,
  targetServer2: 3301,
  socksServer1: 3302,
  httpServerOfSocksServer1: 3303,
  socksServer2: 3304,
  httpServerOfSocksServer2: 3305,
};

// http://elif.site/
const host = '127.0.0.1';
/**
 * Go through the basic work flow
 */
export async function start() {
  const targetServerInfo1 = await startSocketServer(
    {
      port: ports.targetServer1,
    },
    socket => {
      // logWithColor(colors.targetServer, 'socket connect:', getSocketInfo(socket));
      // handleSocketEvents(socket, {isServer: true, color: colors.targetServer});
      socket.on('data', (chunk: Buffer) => {
        socket.write(toBuffer(['from targetServerInfo1:', chunk]));
      });
    }
  );
  const targetServerInfo2 = await startSocketServer(
    {
      port: ports.targetServer2,
    },
    socket => {
      // logWithColor(colors.targetServer, 'socket connect:', getSocketInfo(socket));
      // handleSocketEvents(socket, {isServer: true, color: colors.targetServer});
      socket.on('data', (chunk: Buffer) => {
        socket.write(toBuffer(['from targetServerInfo2:', chunk]));
      });
    }
  );
  // logWithColor(colors.targetServer, `target service port: ${targetServerInfo1.port}`);
  const {socksService: socksService1, httpService: httpService1} = await runSocksServerOnSocket({
    httpServerConfig: {
      port: ports.httpServerOfSocksServer1,
    },
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'socksService1'}},
    ],
    serverConfig: {
      host,
      port: ports.socksServer1,
      options: {
        allowHalfOpen: true,
      },
    },
    onConnection(status) {},
  });
  logWithColor('yellow', `socks service1 start http server at: ${httpService1.url}`);

  const {socksService: socksService2, httpService: httpService2} = await runSocksServerOnSocket({
    httpServerConfig: {
      port: ports.httpServerOfSocksServer2,
    },
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'socksService'}},
    ],
    serverConfig: {
      host,
      port: ports.socksServer2,
      options: {
        allowHalfOpen: true,
      },
    },
    proxyAsSocketClientConfigList: [
      {
        methodList: [
          {method: EMethod.NoAuth},
          {method: EMethod.UserPass, info: {username: 'aaa', password: 'socksService1'}},
        ],
        socketConfig: {
          host,
          port: socksService1.port,
        },
        matches: [/elif\.site/, {address: host, port: targetServerInfo1.port}],
      },
    ],
    onConnection(status) {},
  });
  logWithColor('yellow', `socks service start http server at: ${httpService2.url}`);

  const client1 = await connectToSocksServer({
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'socksService'}},
    ],
    socketConfig: {host, port: socksService2.port, allowHalfOpen: true},
    targetServiceInfo: {
      address: targetServerInfo1.host,
      port: targetServerInfo1.port,
    },
  });
  if (client1.error) {
    console.log(client1.error);
  } else {
    handleSocketEvents(client1.socket, {color: colors.socksClient});
    logWithColor(colors.socksClient, getSocketInfo(client1.socket));
    await writeDataByInterval(client1.socket, {
      startChar: 'b',
      endStr: 'bye',
      maxCount: 3,
    });
  }
  const client2 = await connectToSocksServer({
    methodList: [
      {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'aaa', password: 'socksService'}},
    ],
    socketConfig: {host, port: socksService2.port, allowHalfOpen: true},
    targetServiceInfo: {
      address: targetServerInfo2.host,
      port: targetServerInfo2.port,
    },
  });
  if (client2.error) {
    console.log(client2.error);
  } else {
    handleSocketEvents(client2.socket, {color: colors.socksClient});
    logWithColor(colors.socksClient, getSocketInfo(client2.socket));
    await writeDataByInterval(client2.socket, {
      startChar: 'b',
      endStr: 'bye',
      maxCount: 3,
    });
  }
}
