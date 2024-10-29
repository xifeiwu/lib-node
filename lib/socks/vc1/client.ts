import {Socket} from 'net';
import {clientSendNegotiationInfo, clientWaitRequestTargetResponse} from './communication';
import {clientState, defaultIvBytes} from './service';
import {NegotiationWithServer} from '../types';
import {pushState, toRequestTargetV5} from '..';
import {ECommand} from '../types/v5';
import {NegotiationInfoClient} from '../types/vc1';
import {StateTracer} from '../types/base';
import {getIv} from '../service/external';

export const negotiation: NegotiationWithServer<1> = async (
  socket: Socket,
  negotiationInfo: NegotiationInfoClient,
  stateTracer?: StateTracer
) => {
  stateTracer = stateTracer ?? [];
  const {auth} = negotiationInfo;
  const requestTarget = toRequestTargetV5(negotiationInfo.requestTarget, ECommand.CONNECT);
  const iv = getIv(defaultIvBytes);
  await clientSendNegotiationInfo(socket, {
    iv,
    auth,
    requestTarget,
  });
  pushState(clientState.sentConnectionInfo, stateTracer);
  const requestTargetResponse = await clientWaitRequestTargetResponse(socket, iv);
  pushState(clientState.gotRepliedTargetServiceInfo, stateTracer);
  pushState({key: 'requestTargetResponse', value: requestTargetResponse}, stateTracer);
  return {
    iv,
    auth,
    requestTarget,
    requestTargetResponse,
  };
};
