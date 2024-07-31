import {
  serverReplyMethod,
  serverRespondClientRequest,
  serverReplyUserPassAuthResult,
  serverWaitMethod,
  serverWaitClientRequestInfo,
  serverWaitUserPass,
} from './communication';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from '../service';
import {
  EMethod,
  EHandleClientRequestState,
  UserPassInfo,
  SocksClientStatus,
  SocksServerNegotiationInfoV5,
  GetClientRequestInfoFunc,
  ConnectToTargetServerFunc,
} from '../service/types';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {serverState} from './service';
import {handleConnection, proxySocksRequest} from '../service/cross';

/**
 * To know what client side want to do
 */
export const getClientRequestInfo: GetClientRequestInfoFunc<'v5'> = async (
  socket: Socket,
  config: SocksServerNegotiationInfoV5,
  clientInfo: SocksClientStatus
) => {
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
  const clientRequestInfo = await serverWaitClientRequestInfo(socket);
  stateTracer.push(serverState.gotTargetServiceInfo);
  stateTracer.push({
    key: 'clientRequestInfo',
    value: clientRequestInfo,
  });
  return {clientRequestInfo};
}

export const connectToTargetServer: ConnectToTargetServerFunc<'v5'> = async (
  socket: Socket,
  config: SocksServerNegotiationInfoV5,
  clientInfo: SocksClientStatus
) => {
  const {stateTracer} = clientInfo;
  const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'clientRequestInfo');
  stateTracer.push(globalServerState.startHandleClientRequest);
  const {proxyConfigList} = config;
  let socket2Service: Socket;
  const proxyStatus = proxyConfigList && (await proxySocksRequest(clientRequestInfo, proxyConfigList));
  if (proxyStatus) {
    const {
      stateTracer: tracer = [],
      proxyClientInfo: {respondClientRequest, socket: proxySocket},
    } = proxyStatus;
    stateTracer.push(...tracer);
    const replied = {
      reply: EHandleClientRequestState.succeeded,
      ...(respondClientRequest ?? {address: '8.8.8.8', port: 88}),
    };
    await serverRespondClientRequest(socket, replied);
    stateTracer.push(serverState.repliedTargetServiceInfo);
    stateTracer.push({
      key: 'respondClientRequest',
      value: replied,
    });
    socket2Service = proxySocket;
  } else {
    stateTracer.push(globalServerState.startHandleConnection);
    const {socket: theSocket, connectState, respondClientRequest: repliedServiceInfo} = await handleConnection(clientRequestInfo);
    const reply = {
      reply: connectState,
      ...repliedServiceInfo,
    };
    stateTracer.push({
      key: 'respondClientRequest',
      value: reply,
    });
    await serverRespondClientRequest(socket, reply);
    if (connectState !== EHandleClientRequestState.succeeded) {
      throw createError(ERRORS.handleClientRequestFail);
    }
    socket2Service = theSocket;
  }

  return {socket: socket2Service, proxyClientInfo: proxyStatus?.proxyClientInfo};
}
