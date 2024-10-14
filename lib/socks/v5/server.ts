import {
  serverReplyMethod,
  serverSendRequestTargetResponse,
  serverReplyUserPassAuthResult,
  serverWaitMethod,
  serverWaitRequestTarget,
  serverWaitUserPass,
} from './communication';
import {ERRORS, createError, pushState} from '..';
import {NegotiationWithClient} from '../types';
import {
  EMethod,
  UserPassInfo,
  ServerConfig,
  RequestTargetResponseV5,
  NegotiationResult,
} from '../types/v5';
import {deepEqual} from '../service/external';
import {Socket} from 'net';
import {SERVER_STATE_V5} from './service';
import {StateTracer} from '../types/base';

/**
 * To know what client side want to do
 */
export const negotiation: NegotiationWithClient<5> = async (
  socket: Socket,
  config: ServerConfig,
  stateTracer?: StateTracer
) => {
  pushState(SERVER_STATE_V5.waitingMethodList, stateTracer);
  const {methodList = [{method: EMethod.NoAuth}]} = config ?? {};
  const method = await serverWaitMethod(
    socket,
    methodList.map(it => it.method)
  );
  await serverReplyMethod(socket, method);
  pushState(`${SERVER_STATE_V5.repliedMethod}: ${method}`, stateTracer);
  if (method === EMethod.UserPass) {
    const methodInfo = methodList.find(it => it.method === method) as {
      method: EMethod.UserPass;
      info: UserPassInfo;
    };
    pushState(SERVER_STATE_V5.waitingAuthUserPass, stateTracer);
    const userInfo = await serverWaitUserPass(socket);
    const authSuccess = deepEqual(
      methodInfo.info,
      Object.entries(userInfo).reduce<object>((sum, [key, value]) => {
        sum[key] = value.toString();
        return sum;
      }, {})
    );
    if (!authSuccess) {
      pushState(SERVER_STATE_V5.waitingAuthUserPass, stateTracer);
      throw createError(ERRORS.authUserPassFail);
    }
    await serverReplyUserPassAuthResult(socket, authSuccess);
    pushState(SERVER_STATE_V5.authUserPassSuccess, stateTracer);
  }
  pushState(SERVER_STATE_V5.waitingTargetServiceInfo, stateTracer);
  const requestTarget = await serverWaitRequestTarget(socket);
  pushState(SERVER_STATE_V5.gotTargetServiceInfo, stateTracer);
  return {method: methodList.find(it => it.method === method), requestTarget};
};

export async function sendRequestTargetResponse(
  socket: Socket,
  response: RequestTargetResponseV5,
  negotiationResult: NegotiationResult
) {
  negotiationResult.requestTargetResponse = response;
  return await serverSendRequestTargetResponse(socket, response);
}
// export const connectToTargetServer: ConnectToTargetServerFunc<'v5'> = async (
//   socket: Socket,
//   config: SocksServerNegotiationInfoV5,
//   clientInfo: SocksInfoOnClient
// ) => {
//   const {stateTracer} = clientInfo;
//   const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'requestTarget');
//   pushState(globalServerState.startHandleClientRequest, stateTracer);
//   const {proxyConfigList} = config;
//   let socket2Service: Socket;
//   const proxyStatus = proxyConfigList && (await proxySocksRequest(clientRequestInfo, proxyConfigList));
//   if (proxyStatus) {
//     const {
//       stateTracer: tracer = [],
//       proxyClientInfo: {respondClientRequest, socket: proxySocket},
//     } = proxyStatus;
//     pushState(...tracer, stateTracer);
//     const replied = {
//       reply: EHandleRequestTargetState.succeeded,
//       ...(respondClientRequest ?? {address: '8.8.8.8', port: 88}),
//     };
//     await serverSendRequestTargetResponse(socket, replied);
//     pushState(serverState.repliedTargetServiceInfo, stateTracer);
//     pushState, stateTracer({
//       key: 'respondOfRequestTarget',
//       value: replied,
//     });
//     socket2Service = proxySocket;
//   } else {
//     pushState(globalServerState.startHandleConnection, stateTracer);
//     const {socket: theSocket, connectState, requestTarget} = await connectFromLocal(clientRequestInfo);
//     const reply: RespondOfRequestTarget = {
//       reply: connectState as EHandleRequestTargetState,
//       ...requestTarget,
//     };
//     pushState, stateTracer({
//       key: 'respondOfRequestTarget',
//       value: reply,
//     });
//     await serverSendRequestTargetResponse(socket, reply);
//     if (connectState !== EHandleRequestTargetState.succeeded) {
//       throw createError(ERRORS.handleClientRequestFail);
//     }
//     socket2Service = theSocket;
//   }

//   return {socket: socket2Service, proxyClientInfo: proxyStatus?.proxyClientInfo};
// };
