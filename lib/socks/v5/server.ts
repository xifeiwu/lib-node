import {
  serverReplyMethod,
  serverReplyTargetServiceInfo,
  serverReplyUserPassAuthResult,
  serverWaitMethod,
  serverWaitTargetServiceInfo,
  serverWaitUserPass,
} from './communication';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from '../service';
import {
  EMethod,
  ETargetServiceConnectState,
  UserPassInfo,
  SocksServerConfig,
  SocksClientInfo,
  SocksServerExchangeInfoConfigV5,
  SocksClientExchangeInfoConfigV5,
} from '../service/types';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {serverState} from './service';
import {handleConnection, proxySocksRequest} from '../service/cross';

/**
 * To know what client side want to do
 */
export async function getClientRequestInfo(
  socket: Socket,
  config: SocksServerExchangeInfoConfigV5,
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
  // return {stateTracer, clientRequest};
}

export async function connectToTargetServer(
  socket: Socket,
  config: SocksServerExchangeInfoConfigV5,
  clientInfo: SocksClientInfo
) {
  const {stateTracer} = clientInfo;
  const clientRequest = getInfoFromStateTracer(stateTracer, 'clientRequest');
  stateTracer.push(globalServerState.startHandleClientRequest);
  const {proxyConfigList} = config;
  let socket2Service: Socket;
  const proxyStatus = proxyConfigList && (await proxySocksRequest(clientRequest, proxyConfigList));
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
      key: 'serverReplyClientRequest',
      value: replied,
    });
    socket2Service = proxySocket;
  } else {
    stateTracer.push(globalServerState.startHandleConnection);
    const {socket: theSocket, connectState, repliedServiceInfo} = await handleConnection(clientRequest);
    const reply = {
      reply: connectState,
      ...repliedServiceInfo,
    };
    stateTracer.push({
      key: 'serverReplyClientRequest',
      value: reply,
    });
    await serverReplyTargetServiceInfo(socket, reply);
    if (connectState !== ETargetServiceConnectState.succeeded) {
      throw createError(ERRORS.handleClientRequestFail);
    }
    socket2Service = theSocket;
  }

  return {socket: socket2Service, stateTracer, proxyClientInfo: proxyStatus?.proxyClientInfo};
}
