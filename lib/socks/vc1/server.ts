import {Socket} from 'net';
import {serverSendNegotiationResponse, serverWaitNegotiationInfo} from './communication';
import {ERRORS, createError} from '../service';
import {NegotiationWithClient} from '../service/types';
import {deepEqual} from '../service/external';
import {serverState} from './service';
import {NegotiationResult, ServerConfig} from '../service/types/vc1';
import {StateTracer} from '../service/types/base';
import {RequestTargetV5Response} from '../service/types/v5';

export const negotiation: NegotiationWithClient<'vc1'> = async (
  socket: Socket,
  config: ServerConfig,
  stateTracer?: StateTracer
) => {
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

export async function sendRequestTargetResponse(
  socket: Socket,
  response: RequestTargetV5Response,
  negotiationResult: NegotiationResult
) {
  const {iv} = negotiationResult;
  if (iv === undefined) {
    throw new Error(`iv is undefined`);
  }
  negotiationResult.requestTargetResponse = response;
  return await serverSendNegotiationResponse(socket, response, iv);
}
