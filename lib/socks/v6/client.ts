import {Socket} from 'net';
import {requestAndGetUpgradeInfo, startSocketClient} from '../service';
import {
  ClientConfig,
  ECommand,
  EMethod,
  ESocksState,
  SocksStatusOnClientSide,
  TargetServiceInfo,
  UserPassInfo,
} from '../service/types';
import {upgradeProtocol} from '../service';
import {clientSendConnectionInfo, clientWaitRepliedTargetServiceInfo} from './communication';
import {getIv, ivLength} from './service';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToCustomSocksServer(config: ClientConfig) {
  const {socketConfig, httpUrl, methodList, targetServiceInfo: target} = config;
  const authMethod = methodList.find(it => it.method === EMethod.UserPass);
  if (!authMethod) {
    throw new Error(`only support method: ${EMethod.UserPass}`);
  }
  const {info: auth} = authMethod as {method: EMethod.UserPass; info: UserPassInfo};
  const status: SocksStatusOnClientSide = {
    state: ESocksState.initial,
  };
  try {
    status.state = ESocksState.connecting;
    let socket: Socket;
    if (socketConfig) {
      socket = await startSocketClient(socketConfig);
    } else if (httpUrl) {
      const {socket: _socket} = await requestAndGetUpgradeInfo({
        url: httpUrl,
        headers: {
          Connection: 'Upgrade',
          Upgrade: upgradeProtocol,
        },
      });
      socket = _socket;
    } else {
      throw new Error(`Error: both socketConfig and httpUrl are not set.`);
    }
    socket.once('error', () => {
      if (socket.writable) {
        socket.end();
      }
    });

    status.state = ESocksState.connected;
    const iv = getIv(ivLength);
    const {address, port} = target;
    const targetServiceInfo: TargetServiceInfo = {
      address,
      port,
    };
    await clientSendConnectionInfo(socket, {
      iv,
      auth,
      targetServiceInfo: {
        command: ECommand.CONNECT,
        ...targetServiceInfo,
      },
    });
    status.targetServiceInfo = targetServiceInfo;
    const replyServiceInfo = await clientWaitRepliedTargetServiceInfo(socket, iv);
    status.replyServiceInfo = replyServiceInfo;
    socket.resume();
    status.socket = socket;
    status.iv = iv;
    status.state = ESocksState.success;
  } catch (err) {
    const {socket} = status;
    socket && socket.writable && socket.end();
    // const failState = getFailState(status.state);
    // if (failState) {
    //   status.state = failState;
    // }
    status.error = err;
    throw err;

  }
  return status;
}
