import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendTargetServiceInfo,
  clientSendUserPass,
  clientWaitTargetServiceInfoReplied,
} from './communication';
import {getSocket} from './service';
import {
  ECommand,
  EMethod,
  UserPassInfo,
  ESocksState,
  TargetServiceInfo,
  SocksStatusOnClientSide,
  CommonSocksClientConfig,
} from './service/types';
// import {connectToCustomSocksServer} from '../protocol-custom';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer(config: CommonSocksClientConfig) {
  const {cipher, socketConfig, httpUrl, methodList, targetServiceInfo: target} = config;
  // if (cipher) {
  //   return connectToCustomSocksServer(config);
  // }
  /** Use authorized method first */
  methodList.sort((pre, next) => next.method - pre.method);
  const status: SocksStatusOnClientSide = {
    stateTracer: ESocksState.initial,
  };
  try {
    status.stateTracer = ESocksState.startConnectToSocksServer;
    let socket = await getSocket(socketConfig ?? httpUrl);
    if (!socket) {
      throw new Error(`fail to connect to socks server by ${JSON.stringify(socketConfig)}`);
    }
    // socket.once('error', () => {
    //   if (socket.writable) {
    //     socket.end();
    //   }
    // });

    status.stateTracer = ESocksState.startMethodNegotiation;
    await clientSendMethod(
      socket,
      methodList.map(it => it.method)
    );
    const method = await clientWaitMethodReplied(
      socket,
      methodList.map(it => it.method)
    );
    status.stateTracer = ESocksState.methodNegotiationSuccess;
    status.method = method;
    if (method === EMethod.UserPass) {
      const methodInfo = methodList.find(it => it.method === method) as {
        method: EMethod.UserPass;
        info: UserPassInfo;
      };
      status.stateTracer = ESocksState.startAuthUserPass;
      await clientSendUserPass(socket, methodInfo.info);
      await clientWaitUserPassAuthResultReplied(socket);
      status.stateTracer = ESocksState.authUserPassSuccess;
    }
    {
      const {address, port} = target;
      const targetServiceInfo: TargetServiceInfo = {
        address,
        port,
      };
      await clientSendTargetServiceInfo(socket, {
        command: ECommand.CONNECT,
        ...targetServiceInfo,
      });
      status.targetServiceInfo = targetServiceInfo;
    }
    const replyServiceInfo = await clientWaitTargetServiceInfoReplied(socket);
    status.repliedServiceInfo = replyServiceInfo;
    socket.resume();
    status.socket = socket;
    status.stateTracer = ESocksState.success;
  } catch (err) {
    const {socket} = status;
    socket && socket.writable && socket.end();
    // const failState = getFailState(status.state);
    // if (failState) {
    //   status.state = failState;
    // }
    status.error = err;
  }
  return status;
}
