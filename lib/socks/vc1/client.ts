import {Socket} from 'net';
import {clientSendNegotiationInfo, clientWaitNegotiationResponse} from './communication';
import {clientState, getIv, defaultIvBytes} from './service';
import {NegotiationWithServer} from '../service/types';
import {pushState, toRequestTargetV5} from '../service';
import {ECommand} from '../service/types/v5';
import {NegotiationInfo} from '../service/types/vc1';
import {StateTracer} from '../service/types/base';

export const negotiation: NegotiationWithServer<'vc1'> = async (
  socket: Socket,
  config: NegotiationInfo,
  stateTracer?: StateTracer
) => {
  stateTracer = stateTracer ?? [];
  const {auth} = config;
  const requestTarget = toRequestTargetV5(config.requestTarget, ECommand.CONNECT);
  const iv = getIv(defaultIvBytes);
  await clientSendNegotiationInfo(socket, {
    iv,
    auth,
    requestTarget,
  });
  pushState(clientState.sentConnectionInfo, stateTracer);
  const requestTargetResponse = await clientWaitNegotiationResponse(socket, iv);
  pushState(clientState.gotRepliedTargetServiceInfo, stateTracer);
  pushState({key: 'requestTargetResponse', value: requestTargetResponse}, stateTracer);
  return {
    iv,
    auth,
    requestTarget,
    requestTargetResponse,
  };
};
