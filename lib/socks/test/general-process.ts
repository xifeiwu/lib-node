/** Show general process of each version */
import {
  getRequestInfo,
  getSocketInfo,
  startHttpServer,
  toBuffer,
  watchSocketState,
  PORT,
  startHttpDebugServer,
  startSocketServer,
  tcpRequestPropsToBuffer,
} from '../service/external';
import {connectToSocksServer} from '../client';
import {handleConnection} from '../server';
import {
  NegotiationInfo,
  SocksClientConfig,
  SocksProxyConfig,
  SocksServerConfig,
  TargetSocksServer,
} from '../service/types';
import {EMethod, NegotiationInfoClient as NegotiationInfoClientV5, UserPassInfo} from '../service/types/v5';
import {logColorful} from '../../../log';
import {NegotiationInfoClient as NegotiationInfoClientVc1} from '../service/types/vc1';
import {RequestTarget} from '../service/types/base';

const auth: UserPassInfo = {
  username: 'abc',
  password: 'dddd',
};

async function startSocksServerV5() {
  const socksServerConfig: SocksServerConfig<'v5'> = {
    socksVersion: 'v5',
    methodList: [{method: EMethod.NoAuth}],
  };
  return await startSocketServer(socket => {
    handleConnection(socket, socksServerConfig);
  });
}
function getSocksClientConfigV5(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<'v5'> = {
    socksVersion: 'v5',
    methodList: [{method: EMethod.NoAuth}, {method: EMethod.UserPass, info: auth}],
    socksServer,
    requestTarget,
  };
  return info;
}

async function startSocksServerVc1() {
  const socksServerConfig: SocksServerConfig<'vc1'> = {socksVersion: 'vc1', auth: auth};
  return await startSocketServer(socket => {
    handleConnection(socket, socksServerConfig);
  });
}
function getSocksClientConfigVc1(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<'vc1'> = {
    socksVersion: 'vc1',
    auth,
    socksServer,
    requestTarget,
  };
  return info;
}

const httpRequestBuffer = tcpRequestPropsToBuffer({
  method: 'post',
  url: '/api/test',
  data: {a: 1},
});

export async function generalProcessV5() {
  // const socketServerInfo = await startSocksServerVc1();
  const socketServerInfo = await startSocksServerV5();
  const {host, port, server: socksServer} = socketServerInfo;
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  const status = await connectToSocksServer(getSocksClientConfigV5({host, port}, httpOrigin));
  const {socket} = status;
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  socket.write(httpRequestBuffer);
  await new Promise<void>((res, rej) => {
    socket.on('data', chunk => {
      console.log(chunk.toString());
      res();
    });
  });
  httpServer.close();
  // socksServer.close();
}

export async function generalProcessVc1() {
  const socketServerInfo = await startSocksServerVc1();
  const {host, port} = socketServerInfo;
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  const status = await connectToSocksServer(getSocksClientConfigVc1({host, port}, httpOrigin));
  const {socket} = status;
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  socket.write(httpRequestBuffer);
  await new Promise<void>((res, rej) => {
    socket.on('data', chunk => {
      console.log(chunk.toString());
      res();
    });
  });
  httpServer.close();
}
