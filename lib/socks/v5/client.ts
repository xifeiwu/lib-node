import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendRequestTarget,
  clientSendUserPass,
  clientWaitRespondOfRequestTarget,
} from './communication';
import {getRequestTarget} from '../service';
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
  const requestTarget = getRequestTarget(config.requestTarget, ECommand.CONNECT);
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
  stateTracer.push({
    key: 'requestTarget',
    value: requestTarget,
  });
  await clientSendRequestTarget(socket, requestTarget);
  const respondOfRequestTarget = await clientWaitRespondOfRequestTarget(socket);
  stateTracer.push(clientState.getRepliedTargetSericeInfo);
  stateTracer.push({key: 'respondOfRequestTarget', value: respondOfRequestTarget});
  return {
    respondOfRequestTarget,
  };
};
