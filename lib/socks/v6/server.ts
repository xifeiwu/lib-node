import {serverRespondRequestTarget, serverWaitConectionInfo} from './communication';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from '../service';
import {
  ConnectToTargetServerFunc,
  EHandleRequestTargetState,
  GetClientRequestTargetFunc,
  RespondOfRequestTarget,
  SocksClientStatus,
  SocksServerNegotiationInfoV6,
} from '../service/types';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {serverState} from './service';
import {handleConnection, proxySocksRequest} from '../service/cross';

export const getClientRequestTarget: GetClientRequestTargetFunc<'v6'> = async (
  socket: Socket,
  config: SocksServerNegotiationInfoV6,
  clientInfo: SocksClientStatus
) => {
  const {stateTracer} = clientInfo;
  stateTracer.push(serverState.waitingConnectionInfo);
  const {iv, auth, requestTarget} = await serverWaitConectionInfo(socket);
  stateTracer.push(serverState.gotConnectionInfo);
  stateTracer.push({
    key: 'requestTarget',
    value: requestTarget,
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
    requestTarget: requestTarget,
  };
};

export const connectToTargetServer: ConnectToTargetServerFunc<'v6'> = async (
  socket: Socket,
  config: SocksServerNegotiationInfoV6,
  clientInfo: SocksClientStatus
) => {
  const {stateTracer} = clientInfo;
  const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'requestTarget');
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
      proxyClientInfo: {respondClientRequest, socket: proxySocket},
    } = proxyStatus;
    stateTracer.push(...tracer);
    const replied = {
      reply: EHandleRequestTargetState.succeeded,
      ...(respondClientRequest ?? {address: '8.8.8.8', port: 88}),
    };
    await serverRespondRequestTarget(socket, replied, iv);
    stateTracer.push(serverState.repliedTargetServiceInfo);
    stateTracer.push({
      key: 'respondOfRequestTarget',
      value: replied,
    });
    socket2Service = proxySocket;
  } else {
    const {socket: theSocket, connectState, requestTarget} = await handleConnection(clientRequestInfo);
    const reply: RespondOfRequestTarget = {
      reply: connectState as EHandleRequestTargetState,
      ...requestTarget,
    };
    stateTracer.push({
      key: 'respondOfRequestTarget',
      value: reply,
    });
    await serverRespondRequestTarget(socket, reply, iv);
    if (connectState !== EHandleRequestTargetState.succeeded) {
      throw createError(ERRORS.handleClientRequestFail);
    }
    socket2Service = theSocket;
  }

  return {socket: socket2Service, proxyClientInfo: proxyStatus?.proxyClientInfo};
};
