import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendTargetServiceInfo,
  clientSendUserPass,
  clientWaitRepliedTargetServiceInfo,
} from './communication';
import {getSocket, getTargetServiceInfo} from '../service';
import {ECommand, EMethod, UserPassInfo, SocksClientStatus, SocksClientConfigV5} from '../service/types';
import {clientState} from './service';
import {SocketClientCommConfig} from '../service/types/cross';
import {Socket} from 'net';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function socketCommunication(socket: Socket, config: SocketClientCommConfig<'v5'>) {
  // const stateTracer: string[] = [clientState.initial];
  const {methodList = [{method: EMethod.NoAuth}], stateTracer} = config;
  let {targetServiceInfo} = config;
  targetServiceInfo = getTargetServiceInfo(targetServiceInfo);
  /** Use authorized method first */
  methodList.sort((pre, next) => next.method - pre.method);

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
  return {
    targetServiceInfo,
    repliedServiceInfo: await clientWaitRepliedTargetServiceInfo(socket),
  };
}
