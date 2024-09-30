import {Socket} from 'net';
import {clientSendConnectionInfo, clientWaitRespondOfRequestTarget} from './communication';
import {clientState, getIv, defaultIvBytes} from './service';
import {
  SocksClientStatus,
  SocksClientNegotiationInfoV6,
  ECommand,
  InfoNegotiationFunc,
} from '../service/types';
import {getRequestTarget} from '../service';

export const infoNegotiation: InfoNegotiationFunc<'v6'> = async (
  socket: Socket,
  config: SocksClientNegotiationInfoV6,
  clientInfo?: SocksClientStatus
) => {
  const {stateTracer} = clientInfo ?? {};
  const {ivBytes = defaultIvBytes, auth} = config;
  const clientRequestInfo = getRequestTarget(config.requestTarget);
  const iv = getIv(ivBytes);
  await clientSendConnectionInfo(socket, {
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
  const respondOfRequestTarget = await clientWaitRespondOfRequestTarget(socket, iv);
  stateTracer.push(clientState.gotRepliedTargetServiceInfo);
  stateTracer.push({key: 'respondOfRequestTarget', value: respondOfRequestTarget});
  return {
    respondOfRequestTarget,
  };
};
