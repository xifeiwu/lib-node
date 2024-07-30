import dns from 'dns';
import {serverReplyTargetServiceInfo, serverWaitConectionInfo} from './communication';
import {ERRORS, createError, getAddressType} from '../service';
import {
  TargetServiceInfo,
  EMethod,
  ETargetServiceConnectState,
  UserPassInfo,
  SocksServerConfig,
  SocksClientInfo,
  SocksServerExchangeInfoConfigV6,
} from '../service/types/index';
import {deepClone, deepEqual} from '../service/external';
import {Socket, isIP} from 'net';
import {serverState} from './service';
import {proxySocksRequest} from '../service/cross';

export async function getTargetServiceInfo(
  socket: Socket,
  config: SocksServerExchangeInfoConfigV6,
  stateTracer?: SocksClientInfo['stateTracer']
) {
  const {} = config;
  stateTracer = stateTracer ?? [];
  stateTracer.push(serverState.waitConnectionInfo);
  const {iv, auth, targetServiceInfo} = await serverWaitConectionInfo(socket);
  stateTracer.push(serverState.gotConnectionInfo);
  stateTracer.push({targetServiceInfo, iv});
  const authSuccess = deepEqual(config.auth, auth);
  stateTracer.push(authSuccess ? serverState.authSuccess : serverState.authFail);
  if (!authSuccess) {
    throw createError(ERRORS.authUserPassFail);
  }
  return {
    targetServiceInfo, 
  };
}

export async function connectToTargetServer(
  socket: Socket,
  targetServiceInfo: TargetServiceInfo,
  config: SocksServerExchangeInfoConfigV6,
  stateTracer?: SocksClientInfo['stateTracer']
) {
  stateTracer = stateTracer ?? [];
  stateTracer.push(serverState.handleRequest);
  const {proxyConfigList} = config;
  let socket2Service: Socket;
  const proxyStatus = proxyConfigList && (await proxySocksRequest(targetServiceInfo, proxyConfigList));
  if (proxyStatus) {
    const {
      stateTracer: tracer = [],
      proxyClientInfo: {repliedServiceInfo, socket: proxySocket},
    } = proxyStatus;
    stateTracer.push(...tracer);
    const replied = {
      reply: ETargetServiceConnectState.succeeded,
      ...(repliedServiceInfo ?? {address: '8.8.8.8', port: 88}),
    };
    await serverReplyTargetServiceInfo(socket, replied);
    stateTracer.push(serverState.repliedTargetServiceInfo);
    stateTracer.push(replied);
    socket2Service = proxySocket;
  } else {
    const repliedServiceInfo = deepClone<TargetServiceInfo>(targetServiceInfo);
    const isDomain = isIP(targetServiceInfo.address) === 0;
    if (isDomain) {
      stateTracer.push(serverState.startTransferDomainToIp);
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
        stateTracer.push({ip});
      } catch (err) {
        const reply = {
          reply: ETargetServiceConnectState.Host_unreachable,
          ...repliedServiceInfo,
        };
        await serverReplyTargetServiceInfo(socket, reply);
        stateTracer.push(serverState.repliedTargetServiceInfo);
        stateTracer.push(reply);
        throw err;
      }
    }

    stateTracer.push(serverState.startConnectToTargetService);
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
      stateTracer.push(serverState.connectToTargetServiceSuccess);
      const reply = {
        reply: ETargetServiceConnectState.succeeded,
        ...repliedServiceInfo,
      };
      await serverReplyTargetServiceInfo(socket, reply);
      stateTracer.push(serverState.repliedTargetServiceInfo);
      stateTracer.push(reply);
    } catch (err) {
      const reply = {
        reply: ETargetServiceConnectState.Connection_refused,
        ...repliedServiceInfo,
      };
      await serverReplyTargetServiceInfo(socket, reply);
      stateTracer.push(serverState.repliedTargetServiceInfo);
      stateTracer.push(reply);
      throw err;
    }
  }

  return {socket: socket2Service, stateTracer, proxyClientInfo: proxyStatus?.proxyClientInfo};
}
