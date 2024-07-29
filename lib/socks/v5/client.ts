import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendTargetServiceInfo,
  clientSendUserPass,
  clientWaitRepliedTargetServiceInfo,
} from './communication';
import {getSocket, getTargetServiceInfo} from '../service';
import {
  ECommand,
  EMethod,
  UserPassInfo,
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
    stateTracer.push(clientState.connectToSocksServer);
    let socket = await getSocket(targetSocksServer);
    if (!socket) {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    stateTracer.push(clientState.methodNegotiation);
    await clientSendMethod(
      socket,
      methodList.map(it => it.method)
    );
    const method = await clientWaitMethodReplied(
      socket,
      methodList.map(it => it.method)
    );
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
    stateTracer.push(clientState.sendTargetSericeInfo);
    await clientSendTargetServiceInfo(socket, {
      command: ECommand.CONNECT,
      ...targetServiceInfo,
    });
    status.targetServiceInfo = targetServiceInfo;
    status.repliedServiceInfo = await clientWaitRepliedTargetServiceInfo(socket);
    socket.resume();
    status.socket = socket;
    stateTracer.push(clientState.finishedProcess);
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
