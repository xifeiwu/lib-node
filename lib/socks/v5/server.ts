import dns from 'dns';
import {
  serverReplyMethod,
  serverReplyTargetServiceInfo,
  serverReplyUserPassAuthResult,
  serverWaitMethod,
  serverWaitTargetServiceInfo,
  serverWaitUserPass,
} from './communication';
import {getMatchedProxyConfig, ERRORS, createError, getAddressType} from '../service';
import {
  TargetServiceInfo,
  SocksStatusOnServerSide,
  EMethod,
  ETargetServiceConnectState,
  UserPassInfo,
  MethodAuthInfo,
  SocksProxyConfig,
} from '../service/types';
import {deepClone, deepEqual} from '../service/external';
import {Socket, isIP} from 'net';
import {connectToSocksServer} from './client';
import {pipeline} from 'stream';
import {serverState} from './service';

/**
 * Handle new connection on sock server side
 * @param socket
 * @param methodList auth method supported
 * @param proxyConfigList proxy the socket to a new socket which connect to a new socks server
 * @returns
 * Notice:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function handleConnection(
  socket: Socket,
  options?: {
    methodList?: Array<MethodAuthInfo>;
    proxyConfigList?: SocksProxyConfig[];
  }
) {
  const {methodList = [{method: EMethod.NoAuth}], proxyConfigList = []} = options ?? {};
  const stateTracer: string[] = [serverState.initial];
  const status: SocksStatusOnServerSide = {
    socket,
  };
  try {
    stateTracer.push(serverState.waitingMethodList);
    const method = await serverWaitMethod(
      socket,
      methodList.map(it => it.method)
    );
    await serverReplyMethod(socket, method);
    stateTracer.push(`${serverState.replyMethod} ${method}`);
    if (method === EMethod.UserPass) {
      const methodInfo = methodList.find(it => it.method === method) as {
        method: EMethod.UserPass;
        info: UserPassInfo;
      };
      stateTracer.push(serverState.waitingAuthUserPass);
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
      await serverReplyUserPassAuthResult(socket, authSuccess);
    }
    stateTracer.push(serverState.waitingTargetServiceInfo);
    const targetServiceInfo = await serverWaitTargetServiceInfo(socket);
    status.targetServiceInfo = targetServiceInfo;
    const proxyConfig = (proxyConfigList ?? []).find(getMatchedProxyConfig.bind(null, targetServiceInfo));
    stateTracer.push(serverState.connectToTargerService);
    let socket2Service: Socket;
    if (proxyConfig) {
      try {
        const proxyAsClientStatus = await connectToSocksServer({...proxyConfig, targetServiceInfo});
        status.proxyAsClientStatus = proxyAsClientStatus;
        await serverReplyTargetServiceInfo(socket, {
          reply: ETargetServiceConnectState.succeeded,
          ...proxyAsClientStatus.repliedServiceInfo,
        });
        socket2Service = proxyAsClientStatus.socket;
      } catch (err) {
        throw createError(ERRORS.proxyError, err?.message);
      }
    } else {
      const repliedServiceInfo = deepClone<TargetServiceInfo>(targetServiceInfo);
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
          repliedServiceInfo.address = ip;
          repliedServiceInfo.addressType = getAddressType(ip);
        } catch (err) {
          await serverReplyTargetServiceInfo(socket, {
            reply: ETargetServiceConnectState.Host_unreachable,
            ...repliedServiceInfo,
          });
          throw err;
        }
      }

      status.repliedServiceInfo = repliedServiceInfo;
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
            host: repliedServiceInfo.address,
            port: repliedServiceInfo.port,
          });
        });
        await serverReplyTargetServiceInfo(socket, {
          reply: ETargetServiceConnectState.succeeded,
          ...repliedServiceInfo,
        });
      } catch (err) {
        await serverReplyTargetServiceInfo(socket, {
          reply: err as ETargetServiceConnectState,
          ...repliedServiceInfo,
        });
        throw err;
      }
    }
    stateTracer.push(serverState.repliedTargetServiceInfo);
    status.socket2Service = socket2Service;
    socket2Service.once('close', () => {
      stateTracer.push(serverState.socket2ServiceClosed);
    });
    // useful or not?
    // socket2Service.once('error', err => {
    //   stateTracer.push(`${serverState.socket2ServiceError}: ${err?.message}`);
    //   if (socket2Service.writable) {
    //     socket2Service.end();
    //   }
    //   stateTracer.push(`${serverState.connectionError}: ${err?.message}`);
    // });
    if (socket.writable && socket2Service.writable) {
      // const {proxyAsClientStatus} = status;
      // if (proxyAsClientStatus && proxyAsClientStatus.iv) {
      //   const {cipher} = getCipher(status.proxyAsClientStatus.iv);
      //   const dcipher = getDcipher(status.proxyAsClientStatus.iv);
      //   pipeline(socket, cipher, socket2Service, err => {
      //     status.state = serverState.socket_connect_between_client_target_fail;
      //     status.error = err;
      //   });
      //   pipeline(socket2Service, dcipher, socket, err => {
      //     status.state = serverState.socket_connect_between_client_target_fail;
      //     status.error = err;
      //   });
      // } else {
      pipeline(socket, socket2Service, err => {
        // status.stateTracer = serverState.socket_connect_between_client_target_fail;
        // status.error = err;

        stateTracer.push(`${serverState.connectionError}: ${err?.message}`);
      });
      pipeline(socket2Service, socket, err => {
        // status.stateTracer = serverState.socket_connect_between_client_target_fail;
        // status.error = err;

        stateTracer.push(`${serverState.connectionError}: ${err?.message}`);
      });
      // }
      socket.resume();
      // status.stateTracer = serverState.success;
      stateTracer.push(serverState.finishedProcess);
    } else {
      !socket.writable && stateTracer.push(`${serverState.connectionError}: client socket unwritable`);
      !socket2Service.writable &&
        stateTracer.push(`${serverState.connectionError}: target service socket unwritable`);
    }
  } catch (err) {
    const {socket, socket2Service} = status;
    const {message = 'there is an error on socket server'} = err ?? {};
    socket2Service && socket2Service.writable && socket2Service.end(message);
    socket && socket.writable && socket.end(message);
    stateTracer.push(`${serverState.logicError}: ${message}`);
    // status.error = err;
  } finally {
    status.stateTracer = stateTracer;
  }

  return status;
}
