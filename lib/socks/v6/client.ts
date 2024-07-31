import {Socket} from 'net';
import {clientSendConnectionInfo, clientWaitRepliedTargetServiceInfo} from './communication';
import {clientState, getIv, defaultIvBytes} from './service';
import {SocksClientStatus, SocksClientNegotiationInfoV6, ECommand} from '../service/types';
import {getTargetServiceInfo} from '../service';

export async function infoNegotiation(
  socket: Socket,
  config: SocksClientNegotiationInfoV6,
  clientInfo?: SocksClientStatus
) {
  const {stateTracer} = clientInfo;
  const {ivBytes = defaultIvBytes, auth} = config;
  const targetServiceInfo = getTargetServiceInfo(config.clientRequestInfo);
  const iv = getIv(ivBytes);
  await clientSendConnectionInfo(socket, {
    iv,
    auth,
    clientRequestInfo: {
      command: ECommand.CONNECT,
      ...targetServiceInfo,
    },
  });
  stateTracer.push(clientState.sentConnectionInfo);
  stateTracer.push({
    key: 'iv',
    value: iv,
  });
  const respondClientRequest = await clientWaitRepliedTargetServiceInfo(socket, iv);
  stateTracer.push(clientState.gotRepliedTargetServiceInfo);
  stateTracer.push({key: 'respondClientRequest', value: respondClientRequest});
  return {
    respondClientRequest
  }
}
