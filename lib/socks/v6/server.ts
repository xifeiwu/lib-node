import {serverReplyTargetServiceInfo, serverWaitConectionInfo} from './communication';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from '../service';
import {
  ETargetServiceConnectState,
  SocksClientInfo,
  SocksServerExchangeInfoConfigV6,
} from '../service/types/index';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {serverState} from './service';
import {handleConnection, proxySocksRequest} from '../service/cross';

export async function getClientRequestInfo(
  socket: Socket,
  config: SocksServerExchangeInfoConfigV6,
  clientInfo: SocksClientInfo
) {
  const {stateTracer} = clientInfo;
  stateTracer.push(serverState.waitingConnectionInfo);
  const {iv, auth, targetServiceInfo} = await serverWaitConectionInfo(socket);
  stateTracer.push(serverState.gotConnectionInfo);
  stateTracer.push({
    key: 'clientRequest',
    value: targetServiceInfo,
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
    targetServiceInfo,
  };
}

export async function connectToTargetServer(
  socket: Socket,
  config: SocksServerExchangeInfoConfigV6,
  clientInfo: SocksClientInfo
) {
  const {stateTracer} = clientInfo;
  const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'clientRequest');
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
      reply: ETargetServiceConnectState.succeeded,
      ...(repliedServiceInfo ?? {address: '8.8.8.8', port: 88}),
    };
    await serverReplyTargetServiceInfo(socket, replied, iv);
    stateTracer.push(serverState.repliedTargetServiceInfo);
    stateTracer.push({
      key: 'repliedClientRequest',
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
      key: 'serverReplyClientRequest',
      value: reply,
    });
    await serverReplyTargetServiceInfo(socket, reply, iv);
    if (connectState !== ETargetServiceConnectState.succeeded) {
      throw createError(ERRORS.handleClientRequestFail);
    }
    socket2Service = theSocket;
  }

  return {socket: socket2Service, stateTracer, proxyClientInfo: proxyStatus?.proxyClientInfo};
}
