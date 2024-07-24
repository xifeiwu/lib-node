import dns from 'dns';
import {waitConectionInfo, replyTargetServiceInfo} from './utils';

import {deepClone, deepEqual} from '../external';
import {Socket, isIP} from 'net';
// import {connectToSocksServer} from './client';
import {pipeline} from 'stream';
import {
  EMethod,
  ESocksState,
  ETargetServiceConnectState,
  MethodAuthInfo,
  ProxyAsSocksClientConfig,
  SocksStatusOnServerSide,
  TargetServiceInfo,
  UserPassInfo,
} from '../service/types';
import {connectToSocksServer, getMatchedProxyConfig} from '../service';
import {ERRORS, createError, getAddressType} from '../service/protocol';
import {getCipher, getDcipher} from './cipher';
import { watchSocketState } from '../external';

/**
 * Handle new connection on sock server side
 * @param socket
 * @param methodList auth method supported
 * @param proxyAsSocketClientConfigList proxy the socket to a new socket which connect to a new socks server
 * @returns
 * Notice:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function handleCustomConnection(
  socket: Socket,
  methodList: Array<MethodAuthInfo>,
  proxyAsSocketClientConfigList?: ProxyAsSocksClientConfig[]
) {
  const authMethod = methodList.find(it => it.method === EMethod.UserPass) as {
    method: EMethod.UserPass;
    info: UserPassInfo;
  };
  if (!authMethod) {
    throw new Error(`only support method: ${EMethod.UserPass}`);
  }
  // const {info: auth} = authMethod as {method: EMethod.UserPass; info: UserPassInfo};
  // socket.pause();
  const status: SocksStatusOnServerSide = {
    state: ESocksState.initial,
    socket,
  };
  try {
    status.state = ESocksState.wait_targer_service_info;
    const {iv, auth, targetServiceInfo} = await waitConectionInfo(socket);
    status.iv = iv;
    const authSuccess = deepEqual(authMethod.info, auth);
    if (!authSuccess) {
      throw createError(ERRORS.username_password_auth_fail);
    }
    status.targetServiceInfo = targetServiceInfo;
    const proxyAsClientConfig = (proxyAsSocketClientConfigList ?? []).find(
      getMatchedProxyConfig.bind(null, targetServiceInfo)
    );
    status.state = ESocksState.connect_to_targer_service;
    let socket2Service: Socket;
    if (proxyAsClientConfig) {
      const proxyAsClientStatus = await connectToSocksServer({...proxyAsClientConfig, targetServiceInfo});
      status.proxyAsClientStatus = proxyAsClientStatus;
      if (proxyAsClientStatus.error) {
        throw createError(ERRORS.proxy_error);
      }
      await replyTargetServiceInfo(
        socket,
        {
          reply: ETargetServiceConnectState.succeeded,
          ...proxyAsClientStatus.replyServiceInfo,
        },
        iv
      );
      socket2Service = proxyAsClientStatus.socket;
    } else {
      const replyServiceInfo = deepClone<TargetServiceInfo>(targetServiceInfo);

      const isDomain = isIP(targetServiceInfo.address) === 0;
      if (isDomain) {
        try {
          const ip = await new Promise<string>((resolve, reject) => {
            dns.lookup(targetServiceInfo.address, function(err, ip) {
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
          await replyTargetServiceInfo(
            socket,
            {
              reply: ETargetServiceConnectState.Host_unreachable,
              ...replyServiceInfo,
            },
            iv
          );
          throw err;
        }
      }

      status.replyServiceInfo = replyServiceInfo;
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
            rej(ETargetServiceConnectState.general_SOCKS_server_failure);
          });
          socket.connect({
            host: replyServiceInfo.address,
            port: replyServiceInfo.port,
          });
        });
      } catch (err) {
        await replyTargetServiceInfo(
          socket,
          {
            reply: err as ETargetServiceConnectState,
            ...replyServiceInfo,
          },
          iv
        );
        throw err;
      }

      // const ipType = ip2Bytes(socket.localAddress || '127.0.0.1');
      await replyTargetServiceInfo(
        socket,
        {
          reply: ETargetServiceConnectState.succeeded,
          ...replyServiceInfo,
        },
        iv
      );
    }
    status.state = ESocksState.connect_to_targer_service_success;
    status.socket2Service = socket2Service;
    watchSocketState(socket2Service, {color: 'yellow'})
    socket2Service.once('close', () => {
      status.state = ESocksState.finsih;
    });
    // useful or not?
    socket2Service.once('error', err => {
      console.log(`err`);
      console.log(err);
      status.state = ESocksState.connect_to_targer_service_fail;
      // if (socket2Service.writable) {
      //   socket2Service.end();
      // }
      status.error = err;
    });
    if (socket.writable && socket2Service.writable) {
      const {cipher} = getCipher(iv);
      const dcipher = getDcipher(iv);
      socket.on('data', chunk => {
        console.log(`chunk.toString()`);
        console.log(chunk.toString());
      })
      // socket.pipe(socket2Service).pipe(socket);
      pipeline(socket, socket2Service, err => {
        status.state = ESocksState.socket_connect_between_client_target_fail;
        status.error = err;
      });
      pipeline(socket2Service, socket, err => {
        status.state = ESocksState.socket_connect_between_client_target_fail;
        status.error = err;
      });
      socket.resume();
      status.state = ESocksState.success;
    } else {
      if (!socket.writable) {
        status.state = ESocksState.client_socket_unwritable;
      } else {
        status.state = ESocksState.target_socket_unwritable;
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
