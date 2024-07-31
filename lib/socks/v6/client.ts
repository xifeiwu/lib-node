import {Socket} from 'net';
import {clientSendConnectionInfo, clientWaitRequestRespond} from './communication';
import {clientState, getIv, defaultIvBytes} from './service';
import {
  SocksClientStatus,
  SocksClientNegotiationInfoV6,
  ECommand,
  InfoNegotiationFunc,
} from '../service/types';
import {getTargetServiceInfo} from '../service';

export const infoNegotiation: InfoNegotiationFunc<'v6'> = async (
  socket: Socket,
  config: SocksClientNegotiationInfoV6,
  clientInfo?: SocksClientStatus
) => {
  const {stateTracer} = clientInfo;
  const {ivBytes = defaultIvBytes, auth} = config;
  const clientRequestInfo = getTargetServiceInfo(config.clientRequestInfo);
  const iv = getIv(ivBytes);
  await clientSendConnectionInfo(socket, {
    iv,
    auth,
    clientRequestInfo: {
      command: ECommand.CONNECT,
      ...clientRequestInfo,
    },
  });
  stateTracer.push(clientState.sentConnectionInfo);
  stateTracer.push({
    key: 'iv',
    value: iv,
  });
  const respondClientRequest = await clientWaitRequestRespond(socket, iv);
  stateTracer.push(clientState.gotRepliedTargetServiceInfo);
  stateTracer.push({key: 'respondClientRequest', value: respondClientRequest});
  return {
    respondClientRequest,
  };
};
