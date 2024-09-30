import {serverWaitNegotiationInfo, serverSendNegotiationResponse} from './communication';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from '../service';
import {
  ConnectToTargetServerFunc,
  NegotiationWithClient,
  ProxyConfig,
  SocksClientInfo,
  SocksServerNegotiationInfoV6,
} from '../service/types';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {serverState} from './service';
import {handleConnection, proxySocksRequest} from '../service/cross';
import {EHandleRequestTargetState, RequestTargetV5, RequestTargetV5Response} from '../service/types/v5';

export const negotiation: NegotiationWithClient<'vc1'> = async (
  socket: Socket,
  config: SocksServerNegotiationInfoV6,
  clientInfo: SocksClientInfo
) => {
  const {stateTracer} = clientInfo;
  stateTracer.push(serverState.waitingConnectionInfo);
  const {iv, auth, requestTarget} = await serverWaitNegotiationInfo(socket);
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
    iv,
    auth,
    requestTarget,
  };
};

export async function handleRequestTarget(requestTarget: RequestTargetV5, proxyConfigList?: ProxyConfig[]) {


  
}
export const connectToTargetServer: ConnectToTargetServerFunc<'vc1'> = async (
  socket: Socket,
  config: SocksServerNegotiationInfoV6,
  clientInfo: SocksClientInfo
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
    await serverSendNegotiationResponse(socket, replied, iv);
    stateTracer.push(serverState.repliedTargetServiceInfo);
    stateTracer.push({
      key: 'respondOfRequestTarget',
      value: replied,
    });
    socket2Service = proxySocket;
  } else {
    const {socket: theSocket, connectState, requestTarget} = await handleConnection(clientRequestInfo);
    const reply: RequestTargetV5Response = {
      reply: connectState as EHandleRequestTargetState,
      ...requestTarget,
    };
    stateTracer.push({
      key: 'respondOfRequestTarget',
      value: reply,
    });
    await serverSendNegotiationResponse(socket, reply, iv);
    if (connectState !== EHandleRequestTargetState.succeeded) {
      throw createError(ERRORS.handleClientRequestFail);
    }
    socket2Service = theSocket;
  }

  return {socket: socket2Service, proxyClientInfo: proxyStatus?.proxyClientInfo};
};
