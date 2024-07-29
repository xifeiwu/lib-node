import dns from 'dns';
import {
  serverReplyMethod,
  serverReplyTargetServiceInfo,
  serverSendUsernamePasswordResult,
  serverWaitMethod,
  serverWaitTargetServiceInfo,
  serverWaitUserPass,
} from './communication/communication';
import {getMatchedProxyConfig, ERRORS, createError, getAddressType, getFailState} from './service';
import {
  TargetServiceInfo,
  SocksStatusOnServerSide,
  EMethod,
  ESocksState,
  ETargetServiceConnectState,
  UserPassInfo,
  MethodAuthInfo,
  SocksProxyConfig,
} from './service/types';
import {deepClone, deepEqual} from './service/external';
import {Socket, isIP} from 'net';
import {connectToSocksServer} from './client';
import {pipeline} from 'stream';
// import {getCipher, getDcipher} from '../protocol-custom/cipher';

/**
 * Handle new connection on sock server side
 * @param socket
 * @param methodList auth method supported
 * @param proxyAsSocketClientConfigList proxy the socket to a new socket which connect to a new socks server
 * @returns
 * Notice:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function handleConnection(
  socket: Socket,
  methodList: Array<MethodAuthInfo>,
  proxyAsSocketClientConfigList?: SocksProxyConfig[]
) {
  // socket.pause();
  const status: SocksStatusOnServerSide = {
    stateTracer: ESocksState.initial,
    socket,
  };
  // function setStatusState(state: ESocksState) {
  //   if (status.state === undefined) {
  //     status.state = state;
  //   }
  // }
  try {
    status.stateTracer = ESocksState.startMethodNegotiation;
    const method = await serverWaitMethod(
      socket,
      methodList.map(it => it.method)
    );
    await serverReplyMethod(socket, method);
    status.stateTracer = ESocksState.methodNegotiationSuccess;
    status.method = method;
    if (method === EMethod.UserPass) {
      const methodInfo = methodList.find(it => it.method === method) as {
        method: EMethod.UserPass;
        info: UserPassInfo;
      };
      status.stateTracer = ESocksState.startAuthUserPass;
      const userInfo = await serverWaitUserPass(socket);
      const authSuccess = deepEqual(
        methodInfo.info,
        Object.entries(userInfo).reduce<object>((sum, [key, value]) => {
          sum[key] = value.toString();
          return sum;
        }, {})
      );
      if (!authSuccess) {
        throw createError(ERRORS.username_password_auth_fail);
      }
      await serverSendUsernamePasswordResult(socket, authSuccess);
      status.stateTracer = ESocksState.authUserPassSuccess;
    }
    status.stateTracer = ESocksState.waitTargetServiceInfo;
    const targetServiceInfo = await serverWaitTargetServiceInfo(socket);
    status.targetServiceInfo = targetServiceInfo;
    const proxyAsClientConfig = (proxyAsSocketClientConfigList ?? []).find(
      getMatchedProxyConfig.bind(null, targetServiceInfo)
    );
    status.stateTracer = ESocksState.startConnectToTargerService;
    let socket2Service: Socket;
    if (proxyAsClientConfig) {
      const proxyAsClientStatus = await connectToSocksServer({...proxyAsClientConfig, targetServiceInfo});
      status.proxyAsClientStatus = proxyAsClientStatus;
      if (proxyAsClientStatus.error) {
        throw createError(ERRORS.proxyError);
      }
      await serverReplyTargetServiceInfo(socket, {
        reply: ETargetServiceConnectState.succeeded,
        ...proxyAsClientStatus.repliedServiceInfo,
      });
      socket2Service = proxyAsClientStatus.socket;
    } else {
      const replyServiceInfo = deepClone<TargetServiceInfo>(targetServiceInfo);

      const isDomain = isIP(targetServiceInfo.address) === 0;
      if (isDomain) {
        try {
          const ip = await new Promise<string>((resolve, reject) => {
            dns.lookup(targetServiceInfo.address, function (err, ip) {
              if (err) {
                reject(err);
              } else {
                resolve(ip);
              }
            });
          });
          replyServiceInfo.address = ip;
          replyServiceInfo.addressType = getAddressType(ip);
        } catch (err) {
          await serverReplyTargetServiceInfo(socket, {
            reply: ETargetServiceConnectState.Host_unreachable,
            ...replyServiceInfo,
          });
          throw err;
        }
      }

      status.repliedServiceInfo = replyServiceInfo;
      try {
        socket2Service = await new Promise((res, rej) => {
          const socket = new Socket();
          socket.once('connect', () => {
            res(socket);
          });
          socket.once('error', err => {
            rej(ETargetServiceConnectState.general_SOCKS_server_failure);
          });
          socket.once('timeout', err => {
            rej(ETargetServiceConnectState.TTL_expired);
          });
          socket.connect({
            host: replyServiceInfo.address,
            port: replyServiceInfo.port,
          });
        });
      } catch (err) {
        await serverReplyTargetServiceInfo(socket, {
          reply: err as ETargetServiceConnectState,
          ...replyServiceInfo,
        });
        throw err;
      }

      // const ipType = ip2Bytes(socket.localAddress || '127.0.0.1');
      await serverReplyTargetServiceInfo(socket, {
        reply: ETargetServiceConnectState.succeeded,
        ...replyServiceInfo,
      });
    }
    status.stateTracer = ESocksState.connectToTargerServiceSuccess;
    status.socket2Service = socket2Service;
    socket2Service.once('close', () => {
      status.stateTracer = ESocksState.finsih;
    });
    // useful or not?
    socket2Service.once('error', err => {
      status.stateTracer = ESocksState.connectToTargerServiceFail;
      if (socket2Service.writable) {
        socket2Service.end();
      }
      status.error = err;
    });
    if (socket.writable && socket2Service.writable) {
      const {proxyAsClientStatus} = status;
      // if (proxyAsClientStatus && proxyAsClientStatus.iv) {
      //   const {cipher} = getCipher(status.proxyAsClientStatus.iv);
      //   const dcipher = getDcipher(status.proxyAsClientStatus.iv);
      //   pipeline(socket, cipher, socket2Service, err => {
      //     status.state = ESocksState.socket_connect_between_client_target_fail;
      //     status.error = err;
      //   });
      //   pipeline(socket2Service, dcipher, socket, err => {
      //     status.state = ESocksState.socket_connect_between_client_target_fail;
      //     status.error = err;
      //   });
      // } else {
      pipeline(socket, socket2Service, err => {
        status.stateTracer = ESocksState.socket_connect_between_client_target_fail;
        status.error = err;
      });
      pipeline(socket2Service, socket, err => {
        status.stateTracer = ESocksState.socket_connect_between_client_target_fail;
        status.error = err;
      });
      // }
      socket.resume();
      status.stateTracer = ESocksState.success;
    } else {
      if (!socket.writable) {
        status.stateTracer = ESocksState.client_socket_unwritable;
      } else {
        status.stateTracer = ESocksState.target_socket_unwritable;
      }
    }
  } catch (err) {
    const {socket, socket2Service} = status;
    socket2Service && socket2Service.writable && socket2Service.end();
    socket && socket.writable && socket.end();
    // const failState = getFailState(status.state);
    // if (failState) {
    //   status.state = failState;
    // }
    status.error = err;
  }
  return status;
}
