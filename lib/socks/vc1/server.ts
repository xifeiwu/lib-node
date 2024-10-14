import {Socket} from 'net';
import {serverSendRequestTargetResponse, serverWaitNegotiationInfo} from './communication';
import {ERRORS, SERVER_STATE, createError, pushState} from '..';
import {NegotiationWithClient} from '../types';
import {deepEqual} from '../service/external';
import {NegotiationResult, ServerConfig} from '../types/vc1';
import {StateTracer} from '../types/base';
import {RequestTargetResponseV5} from '../types/v5';

export const negotiation: NegotiationWithClient<1> = async (
  socket: Socket,
  config: ServerConfig,
  stateTracer?: StateTracer
) => {
  pushState(SERVER_STATE.waitingNegotiation, stateTracer);
  const {iv, auth, requestTarget} = await serverWaitNegotiationInfo(socket);
  pushState(SERVER_STATE.gotNegotiationInfo, stateTracer);
  const authSuccess = deepEqual(config.auth, auth);
  pushState(authSuccess ? SERVER_STATE.authSuccess : SERVER_STATE.authFail, stateTracer);
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
  response: RequestTargetResponseV5,
  negotiationResult: NegotiationResult
) {
  const {iv} = negotiationResult;
  if (iv === undefined) {
    throw new Error(`iv is undefined`);
  }
  negotiationResult.requestTargetResponse = response;
  return await serverSendRequestTargetResponse(socket, response, iv);
}
