import {Socket} from 'net';
import {clientSendNegotiationInfo, clientWaitNegotiationResponse} from './communication';
import {clientState, getIv, defaultIvBytes} from './service';
import {SocksClientStatus, NegotiationWithServer} from '../service/types';
import {toRequestTargetV5} from '../service';
import {ECommand} from '../service/types/v5';
import {NegotiationInfo} from '../service/types/vc1';

export const negotiation: NegotiationWithServer<'vc1'> = async (
  socket: Socket,
  config: NegotiationInfo,
  clientInfo?: SocksClientStatus
) => {
  const {stateTracer} = clientInfo ?? {};
  const {auth} = config;
  const clientRequestInfo = toRequestTargetV5(config.requestTarget);
  const iv = getIv(defaultIvBytes);
  await clientSendNegotiationInfo(socket, {
    iv,
    auth,
    requestTarget: {
      command: ECommand.CONNECT,
      ...clientRequestInfo,
    },
  });
  stateTracer.push(clientState.sentConnectionInfo);
  stateTracer.push({
    key: 'iv',
    value: iv,
  });
  const respondOfRequestTarget = await clientWaitNegotiationResponse(socket, iv);
  stateTracer.push(clientState.gotRepliedTargetServiceInfo);
  stateTracer.push({key: 'respondOfRequestTarget', value: respondOfRequestTarget});
  return {
    respondOfRequestTarget,
  };
};
