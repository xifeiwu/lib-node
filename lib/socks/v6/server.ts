import {serverReplyTargetServiceInfo, serverWaitConectionInfo} from './communication';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from '../service';
import {
  EHandleClientRequestState,
  SocksClientStatus,
  SocksServerV6NegotiationInfo,
} from '../service/types/index';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {serverState} from './service';
import {handleConnection, proxySocksRequest} from '../service/cross';

export async function getClientRequestInfo(
  socket: Socket,
  config: SocksServerV6NegotiationInfo,
  clientInfo: SocksClientStatus
) {
  const {stateTracer} = clientInfo;
  stateTracer.push(serverState.waitingConnectionInfo);
  const {iv, auth, clientRequestInfo} = await serverWaitConectionInfo(socket);
  stateTracer.push(serverState.gotConnectionInfo);
  stateTracer.push({
    key: 'clientRequestInfo',
    value: clientRequestInfo,
  });
  stateTracer.push({
    key: 'iv',
    value: iv,
  });
  const authSuccess = deepEqual(config.auth, auth);
  stateTracer.push(authSuccess ? serverState.authSuccess : serverState.authFail);
  if (!authSuccess) {
    throw createError(ERRORS.authUserPassFail);
  }
  return {
    targetServiceInfo: clientRequestInfo,
  };
}

export async function connectToTargetServer(
  socket: Socket,
  config: SocksServerV6NegotiationInfo,
  clientInfo: SocksClientStatus
) {
  const {stateTracer} = clientInfo;
  const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'clientRequestInfo');
  const iv = getInfoFromStateTracer(stateTracer, 'iv');
  if ([clientRequestInfo, iv].some(it => it === null)) {
    throw createError('clientRequestInfo, iv is null');
  }
  stateTracer.push(globalServerState.startHandleConnection);
  const {proxyConfigList} = config;
  let socket2Service: Socket;
  const proxyStatus = proxyConfigList && (await proxySocksRequest(clientRequestInfo, proxyConfigList));
  if (proxyStatus) {
    const {
      stateTracer: tracer = [],
      proxyClientInfo: {repliedServiceInfo, socket: proxySocket},
    } = proxyStatus;
    stateTracer.push(...tracer);
    const replied = {
      reply: EHandleClientRequestState.succeeded,
      ...(repliedServiceInfo ?? {address: '8.8.8.8', port: 88}),
    };
    await serverReplyTargetServiceInfo(socket, replied, iv);
    stateTracer.push(serverState.repliedTargetServiceInfo);
    stateTracer.push({
      key: 'respondClientRequest',
      value: replied,
    });
    socket2Service = proxySocket;
  } else {
    const {socket: theSocket, connectState, repliedServiceInfo} = await handleConnection(clientRequestInfo);
    const reply = {
      reply: connectState,
      ...repliedServiceInfo,
    };
    stateTracer.push({
      key: 'respondClientRequest',
      value: reply,
    });
    await serverReplyTargetServiceInfo(socket, reply, iv);
    if (connectState !== EHandleClientRequestState.succeeded) {
      throw createError(ERRORS.handleClientRequestFail);
    }
    socket2Service = theSocket;
  }

  return {socket: socket2Service, stateTracer, proxyClientInfo: proxyStatus?.proxyClientInfo};
}
