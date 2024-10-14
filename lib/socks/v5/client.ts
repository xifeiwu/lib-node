import {
  clientWaitMethodReplied,
  clientWaitUserPassAuthResultReplied,
  clientSendMethod,
  clientSendRequestTarget,
  clientSendUserPass,
  clientWaitRequestTargetResponse,
} from './communication';
import {pushState, toRequestTargetV5} from '..';
import {ECommand, EMethod, NegotiationInfoClient, UserPassInfo} from '../types/v5';
import {clientState} from './service';
import {NegotiationWithServer} from '../types/client';
import {Socket} from 'net';
import {StateTracer} from '../types/base';

export const negotiation: NegotiationWithServer<5> = async (
  socket: Socket,
  negotiationInfo: NegotiationInfoClient,
  stateTracer?: StateTracer
) => {
  const {methodList = [{method: EMethod.NoAuth}]} = negotiationInfo;
  const requestTarget = toRequestTargetV5(negotiationInfo.requestTarget, ECommand.CONNECT);
  /** Use authorized method first */
  methodList.sort((pre, next) => next.method - pre.method);

  pushState(clientState.methodNegotiation, stateTracer);
  await clientSendMethod(
    socket,
    methodList.map(it => it.method)
  );
  const method = await clientWaitMethodReplied(
    socket,
    methodList.map(it => it.method)
  );
  pushState(`${clientState.finishMethodNegotiation}, use method ${method}`, stateTracer);
  if (method === EMethod.UserPass) {
    const methodInfo = methodList.find(it => it.method === method) as {
      method: EMethod.UserPass;
      info: UserPassInfo;
    };
    pushState(clientState.authUserPass, stateTracer);
    await clientSendUserPass(socket, methodInfo.info);
    await clientWaitUserPassAuthResultReplied(socket);
    pushState(clientState.authUserPassSuccess, stateTracer);
  }
  pushState(clientState.sendTargetSericeInfo, stateTracer);
  await clientSendRequestTarget(socket, requestTarget);
  const requestTargetResponse = await clientWaitRequestTargetResponse(socket);
  pushState(clientState.getRepliedTargetSericeInfo, stateTracer);
  // pushState({key: 'respondOfRequestTarget', value: respondOfRequestTarget}, stateTracer);
  return {
    method: methodList.find(it => it.method === method),
    requestTarget,
    requestTargetResponse,
  };
};
