import {Socket} from 'net';
import {requestAndGetUpgradeInfo, startSocketClient} from '../external';
import {
  waitReplyMethod,
  waitReplyUsernamePasswordAuth,
  sendMethod,
  sendTargetServiceInfo,
  sendUsernamePassword,
  waitReplyTargetServiceInfo,
} from './protocol';
import {upgradeProtocol, getFailState} from './utils';
import {
  ECommand,
  EMethod,
  UserPassInfo,
  ESocksState,
  TargetServiceInfo,
  SocksStatusOnClientSide,
  ClientConfig,
} from './types';
import {connectToCustomSocksServer} from '../protocol-custom';

/**
 * Connect to socks server by socket from tcp connect or http upgrade
 * @param config
 * @returns
 * NOTICE:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function connectToSocksServer(config: ClientConfig) {
  const {cipher, socketConfig, httpUrl, methodList, targetServiceInfo: target} = config;
  if (cipher) {
    return connectToCustomSocksServer(config);
  }
  /** Use authorized method first */
  methodList.sort((pre, next) => next.method - pre.method);
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
    status.state = ESocksState.method_negotiation;
    await sendMethod(
      socket,
      methodList.map(it => it.method)
    );
    const method = await waitReplyMethod(
      socket,
      methodList.map(it => it.method)
    );
    status.state = ESocksState.method_negotiation_success;
    status.method = method;
    if (method === EMethod.UserPass) {
      const methodInfo = methodList.find(it => it.method === method) as {
        method: EMethod.UserPass;
        info: UserPassInfo;
      };
      status.state = ESocksState.auth_username_password_start;
      await sendUsernamePassword(socket, methodInfo.info);
      await waitReplyUsernamePasswordAuth(socket);
      status.state = ESocksState.auth_username_password_success;
    }
    {
      const {address, port} = target;
      const targetServiceInfo: TargetServiceInfo = {
        address,
        port,
      };
      await sendTargetServiceInfo(socket, {
        command: ECommand.CONNECT,
        ...targetServiceInfo,
      });
      status.targetServiceInfo = targetServiceInfo;
    }
    const replyServiceInfo = await waitReplyTargetServiceInfo(socket);
    status.replyServiceInfo = replyServiceInfo;
    socket.resume();
    status.socket = socket;
    status.state = ESocksState.success;
  } catch (err) {
    const {socket} = status;
    socket && socket.writable && socket.end();
    // const failState = getFailState(status.state);
    // if (failState) {
    //   status.state = failState;
    // }
    status.error = err;
  }
  return status;
}
