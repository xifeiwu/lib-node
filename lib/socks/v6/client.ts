import {Socket} from 'net';
import {clientSendConnectionInfo, clientWaitRepliedTargetServiceInfo} from './communication';
import {clientState, getIv, defaultIvBytes} from './service';
import {SocksClientInfo, SocksClientExchangeInfoConfigV6, ECommand} from '../service/types';
import {getTargetServiceInfo} from '../service';

export async function exchangeInfo(
  socket: Socket,
  config: SocksClientExchangeInfoConfigV6,
  clientInfo?: SocksClientInfo
) {
  const {stateTracer} = clientInfo;
  const {ivBytes = defaultIvBytes, auth} = config;
  const targetServiceInfo = getTargetServiceInfo(config.targetServiceInfo);
  const iv = getIv(ivBytes);
  await clientSendConnectionInfo(socket, {
    iv,
    auth,
    targetServiceInfo: {
      command: ECommand.CONNECT,
      ...targetServiceInfo,
    },
  });
  stateTracer.push(clientState.sentConnectionInfo);
  stateTracer.push({
    key: 'iv',
    value: iv,
  });
  const repliedClientRequest = await clientWaitRepliedTargetServiceInfo(socket, iv);
  stateTracer.push(clientState.gotRepliedTargetServiceInfo);
  stateTracer.push({key: 'repliedClientRequest', value: repliedClientRequest});
  return {
    repliedClientRequest
  }
}
