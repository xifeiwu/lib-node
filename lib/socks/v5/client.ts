import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendTargetServiceInfo,
  clientSendUserPass,
  clientWaitRepliedTargetServiceInfo,
} from './communication';
import {getTargetServiceInfo} from '../service';
import {ECommand, EMethod, SocksClientInfo, UserPassInfo} from '../service/types';
import {clientState} from './service';
import {SocketClientCommConfig} from '../service/types/cross';
import {Socket} from 'net';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function exchangeInfo(
  socket: Socket,
  config: SocketClientCommConfig<'v5'>,
  stateTracer?: SocksClientInfo['stateTracer']
) {
  stateTracer = stateTracer ?? [];
  const {methodList = [{method: EMethod.NoAuth}]} = config;
  const targetServiceInfo = getTargetServiceInfo(config.targetServiceInfo);
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
  stateTracer.push(targetServiceInfo);
  await clientSendTargetServiceInfo(socket, {
    command: ECommand.CONNECT,
    ...targetServiceInfo,
  });
  const repliedServiceInfo = await clientWaitRepliedTargetServiceInfo(socket);
  stateTracer.push(clientState.getRepliedTargetSericeInfo);
  stateTracer.push(repliedServiceInfo);
  return {
    targetServiceInfo,
    repliedServiceInfo,
    stateTracer,
  };
}
