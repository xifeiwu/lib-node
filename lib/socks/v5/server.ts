import dns from 'dns';
import {
  serverReplyMethod,
  serverReplyTargetServiceInfo,
  serverReplyUserPassAuthResult,
  serverWaitMethod,
  serverWaitTargetServiceInfo,
  serverWaitUserPass,
} from './communication';
import {ERRORS, createError, getAddressType} from '../service';
import {
  TargetServiceInfo,
  EMethod,
  ETargetServiceConnectState,
  UserPassInfo,
  SocksServerConfig,
  SocksClientInfo,
} from '../service/types';
import {deepClone, deepEqual} from '../service/external';
import {Socket, isIP} from 'net';
import {serverState} from './service';
import {proxySocksRequest} from '../service/cross';

export async function getClientRequest(
  socket: Socket,
  config: SocksServerConfig<'v5'>,
  clientInfo: SocksClientInfo
) {
  const {stateTracer = []} = clientInfo;
  stateTracer.push(serverState.waitingMethodList);
  const {methodList = [{method: EMethod.NoAuth}]} = config ?? {};
  const method = await serverWaitMethod(
    socket,
    methodList.map(it => it.method)
  );
  await serverReplyMethod(socket, method);
  stateTracer.push(`${serverState.repliedMethod}: ${method}`);
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
      stateTracer.push(serverState.waitingAuthUserPass);
      throw createError(ERRORS.authUserPassFail);
    }
    await serverReplyUserPassAuthResult(socket, authSuccess);
    stateTracer.push(serverState.authUserPassSuccess);
  }
  stateTracer.push(serverState.waitingTargetServiceInfo);
  const clientRequest = await serverWaitTargetServiceInfo(socket);
  stateTracer.push(serverState.gotTargetServiceInfo);
  stateTracer.push({
    key: 'clientRequest',
    value: clientRequest,
  });
  return {stateTracer, clientRequest};
}

export async function connectToTargetServer(
  socket: Socket,
  targetServiceInfo: TargetServiceInfo,
  config: SocksServerConfig<'v5'>,
  clientInfo: SocksClientInfo
) {
  const {stateTracer} = clientInfo;
  stateTracer.push(serverState.startConnectToTargetService);
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
    stateTracer.push({
      key: 'repliedServiceInfo',
      value: replied,
    });
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
        stateTracer.push(ip);
      } catch (err) {
        const reply = {
          reply: ETargetServiceConnectState.Host_unreachable,
          ...repliedServiceInfo,
        };
        await serverReplyTargetServiceInfo(socket, reply);
        stateTracer.push(serverState.repliedTargetServiceInfo);
        stateTracer.push({
          key: 'repliedServiceInfo',
          value: reply,
        });
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
      stateTracer.push({
        key: 'repliedServiceInfo',
        value: reply,
      });
    } catch (err) {
      const reply = {
        reply: ETargetServiceConnectState.Connection_refused,
        ...repliedServiceInfo,
      };
      await serverReplyTargetServiceInfo(socket, reply);
      stateTracer.push(serverState.repliedTargetServiceInfo);
      stateTracer.push({
        key: 'repliedServiceInfo',
        value: reply,
      });
      throw err;
    }
  }

  return {socket: socket2Service, stateTracer, proxyClientInfo: proxyStatus?.proxyClientInfo};
}
