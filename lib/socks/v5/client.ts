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
import {SocksClientExchangeInfoConfigV5} from '../service/types/cross';
import {Socket} from 'net';

/**
 * 
 */
export async function exchangeInfo(
  socket: Socket,
  config: SocksClientExchangeInfoConfigV5,
  clientInfo?: SocksClientInfo
) {
  const {stateTracer = []} = clientInfo ?? {};
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
  const clientRequest = {
    command: ECommand.CONNECT,
    ...targetServiceInfo,
  };
  stateTracer.push({
    key: 'clientRequest',
    value: clientRequest,
  });
  await clientSendTargetServiceInfo(socket, clientRequest);
  const repliedClientRequest = await clientWaitRepliedTargetServiceInfo(socket);
  stateTracer.push(clientState.getRepliedTargetSericeInfo);
  stateTracer.push({key: 'repliedClientRequest', value: repliedClientRequest});
  return {
    // stateTracer,
    // targetServiceInfo,
    repliedClientRequest,
  };
}
