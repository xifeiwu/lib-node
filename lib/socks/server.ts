import {
  SocksServerInfo,
  SocksVersion,
  SocksServerConfig,
  NegotiationWithClient,
  ServerConfig,
  SendRequestTargetResponse,
} from './service/types';
import {Socket} from 'net';
import {pipeline} from 'stream';
import {ERRORS, createError, globalServerState} from './service';
import {
  negotiation as negotiationV5,
  sendRequestTargetResponse as sendRequestTargetResponseV5,
} from './v5/server';
import {
  negotiation as negotiationVc1,
  sendRequestTargetResponse as sendRequestTargetResponseVc1,
} from './vc1/server';
import {ECommand, RequestTargetV5} from './service/types/v5';
import {handleCommandConnect} from './proxy';

/**
 * Two phases on server side:
 * 1. negotiation with client, get RequestTarget
 * 2. handle RequestTarget
 * 3. response RequestTarget in format of requestTargetResponse
 */
const negotiationWithClient: {
  [version in SocksVersion]: NegotiationWithClient<SocksVersion>;
} = {
  v5: negotiationV5,
  vc1: negotiationVc1,
};

const sendRequestTargetResponse: {
  [version in SocksVersion]: SendRequestTargetResponse<SocksVersion>;
} = {
  v5: sendRequestTargetResponseV5,
  vc1: sendRequestTargetResponseVc1,
};

/**
 * Handle new connection on sock server side
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function handleConnection<Version extends SocksVersion>(
  socket: Socket,
  config: SocksServerConfig<Version>,
  handleRequestTarget?: (requestTarget: RequestTargetV5) => Promise<boolean | undefined>
) {
  const {socksVersion, proxyConfigList, ...serverConfig} = config;
  const info: SocksServerInfo = {
    socksVersion,
    stateTracer: [globalServerState.startNegotiation],
  };
  const {stateTracer} = info;
  try {
    const negotiationResult = await negotiationWithClient[socksVersion](socket, serverConfig, stateTracer);
    const {requestTarget} = negotiationResult;
    if (!requestTarget) {
      throw createError(`Fail to get requestTarget`);
    }
    const {command} = requestTarget;
    if (command === ECommand.CONNECT) {
      stateTracer.push(globalServerState.gotClientRequest);
      const {
        socket: socket2Remote,
        requestTargetResponse,
        socksClientInfo,
      } = await handleCommandConnect(requestTarget, {proxyConfigList, stateTracer});
      await sendRequestTargetResponse[socksVersion](socket, requestTargetResponse, negotiationResult);

      info.socket2Remote = socket2Remote;
      info.socksClientInfo = socksClientInfo;
      socket2Remote.once('close', () => {
        stateTracer.push(globalServerState.socket2ServiceClosed);
      });

      if (!socket || !socket2Remote || socket.destroyed || socket2Remote.destroyed) {
        throw createError(ERRORS.connectionError);
      }
      pipeline(socket, socket2Remote, err => {
        // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
        // status.error = err;
        stateTracer.push(`${globalServerState.connectionError}: ${err?.message}`);
      });
      pipeline(socket2Remote, socket, err => {
        // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
        // status.error = err;
        stateTracer.push(`${globalServerState.connectionError}: ${err?.message}`);
      });
      // }
      socket.resume();
      // status.stateTracer = serverserverState.success;
      stateTracer.push(globalServerState.finishNegotiation);
    } else {
      throw createError(`command ${command} not found`);
    }
  } catch (err) {
    const {socket, socket2Remote} = info;
    const {message = 'there is an error on socket server'} = err ?? {};
    socket2Remote && socket2Remote.writable && socket2Remote.end(message);
    socket && socket.writable && socket.end(message);
    stateTracer.push(`${globalServerState.catchError}: ${message}`);
  } finally {
    info.stateTracer = stateTracer;
  }

  return info;
}
