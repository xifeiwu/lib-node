import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendTargetServiceInfo,
  clientSendUserPass,
  clientWaitTargetServiceInfoReplied,
} from './communication';
import {getSocket, getTargetServiceInfo} from '../service';
import {
  ECommand,
  EMethod,
  UserPassInfo,
  TargetServiceInfo,
  SocksStatusOnClientSide,
  SocksClientConfigV5,
} from '../service/types';
import {clientState} from './service';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer(config: SocksClientConfigV5) {
  const stateTracer: string[] = [clientState.initial];
  const {targetSocksServer, methodList = [{method: EMethod.NoAuth}]} = config;
  let {targetServiceInfo} = config;
  targetServiceInfo = getTargetServiceInfo(targetServiceInfo);
  /** Use authorized method first */
  methodList.sort((pre, next) => next.method - pre.method);
  const status: SocksStatusOnClientSide = {};
  try {
    // status.stateTracer = clientState.startConnectToSocksServer;
    stateTracer.push(clientState.connectToSocksServer);
    let socket = await getSocket(targetSocksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    socket.once('error', () => {
      if (socket.writable) {
        socket.end();
      }
    });

    stateTracer.push(clientState.methodNegotiation);
    await clientSendMethod(
      socket,
      methodList.map(it => it.method)
    );
    const method = await clientWaitMethodReplied(
      socket,
      methodList.map(it => it.method)
    );
    // status.stateTracer = clientState.methodNegotiationSuccess;
    // status.method = method;
    stateTracer.push(`${clientState.finishMethodNegotiation}, use method ${method}`);
    if (method === EMethod.UserPass) {
      const methodInfo = methodList.find(it => it.method === method) as {
        method: EMethod.UserPass;
        info: UserPassInfo;
      };
      stateTracer.push(clientState.authUserPass);
      await clientSendUserPass(socket, methodInfo.info);
      await clientWaitUserPassAuthResultReplied(socket);
      stateTracer.push(clientState.authUserPassSuccess);
    }
    {
      stateTracer.push(clientState.sendTargetSericeInfo);
      // const {address, port} = target;
      // const targetServiceInfo: TargetServiceInfo = {
      //   address,
      //   port,
      // };
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
    // status.stateTracer = clientState.finish;
    stateTracer.push(clientState.finsihProcess);
  } catch (err) {
    const {socket} = status;
    socket && socket.writable && socket.end();
    stateTracer.push(`${clientState.logicError}: ${err.message}`);
    // status.error = err;
    throw err;
  } finally {
    status.stateTracer = stateTracer;
  }
  return status;
}
