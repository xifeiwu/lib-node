import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendRequestTarget,
  clientSendUserPass,
  clientWaitRequestTargetResponse,
} from './communication';
import {toRequestTargetV5} from '../service';
import {SocksClientStatus} from '../service/types';
import {ECommand, EMethod, NegotiationInfo, UserPassInfo} from '../service/types/v5';
import {clientState} from './service';
import {NegotiationWithServer} from '../service/types/client';
import {Socket} from 'net';

export const negotiation: NegotiationWithServer<'v5'> = async (
  socket: Socket,
  config: NegotiationInfo,
  clientInfo?: SocksClientStatus
) => {
  const {stateTracer = []} = clientInfo ?? {};
  const {methodList = [{method: EMethod.NoAuth}]} = config;
  const requestTarget = toRequestTargetV5(config.requestTarget, ECommand.CONNECT);
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
  const requestTargetResponse = await clientWaitRequestTargetResponse(socket);
  stateTracer.push(clientState.getRepliedTargetSericeInfo);
  // stateTracer.push({key: 'respondOfRequestTarget', value: respondOfRequestTarget});
  return {
    method: methodList.find(it => it.method === method),
    requestTarget,
    requestTargetResponse,
  };
};
