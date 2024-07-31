import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendTargetServiceInfo,
  clientSendUserPass,
  clientWaitRequestRespond,
} from './communication';
import {getTargetServiceInfo} from '../service';
import {ECommand, EMethod, SocksClientStatus, UserPassInfo} from '../service/types';
import {clientState} from './service';
import {InfoNegotiationFunc, SocksClientNegotiationInfoV5} from '../service/types/cross';
import {Socket} from 'net';

export const infoNegotiation: InfoNegotiationFunc<'v5'> = async (
  socket: Socket,
  config: SocksClientNegotiationInfoV5,
  clientInfo?: SocksClientStatus
) => {
  const {stateTracer = []} = clientInfo ?? {};
  const {methodList = [{method: EMethod.NoAuth}]} = config;
  const targetServiceInfo = getTargetServiceInfo(config.clientRequestInfo);
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
  const clientRequestInfo = {
    command: ECommand.CONNECT,
    ...targetServiceInfo,
  };
  stateTracer.push({
    key: 'clientRequestInfo',
    value: clientRequestInfo,
  });
  await clientSendTargetServiceInfo(socket, clientRequestInfo);
  const respondClientRequest = await clientWaitRequestRespond(socket);
  stateTracer.push(clientState.getRepliedTargetSericeInfo);
  stateTracer.push({key: 'respondClientRequest', value: respondClientRequest});
  return {
    respondClientRequest,
  };
};
