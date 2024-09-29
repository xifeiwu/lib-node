import {
  SocksServerStatus,
  SocksVersion,
  SocksServerConfig,
  SocksClientStatus,
  SocksServerNegotiationInfoV6,
  GetClientRequestTargetFunc,
  ECommand,
  ConnectToTargetServerFunc,
} from './service/types';
import {Socket} from 'net';
import {pipeline} from 'stream';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from './service';
import {getSocketInfo} from './service/external';
import {
  getClientRequestTarget as getClientRequestTargetV5,
  connectToTargetServer as connectToTargetServerV5,
} from './v5/server';
import {
  getClientRequestTarget as getClientRequestTargetV6,
  connectToTargetServer as connectToTargetServerV6,
} from './v6/server';

const getClientRequestTarget: {
  [version in SocksVersion]: GetClientRequestTargetFunc<SocksVersion>;
} = {
  v5: getClientRequestTargetV5,
  v6: getClientRequestTargetV6,
};
const connectToTargetServer: {
  [version in SocksVersion]: ConnectToTargetServerFunc<SocksVersion>;
} = {
  v5: connectToTargetServerV5,
  v6: connectToTargetServerV6,
};
/**
 * Handle new connection on sock server side
 * @param socket
 * @param methodList auth method supported
 * @param proxyConfigList proxy the socket to a new socket which connect to a new socks server
 * @returns
 * Notice:
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function handleConnection<Version extends SocksVersion>(
  socket: Socket,
  config?: SocksServerConfig<Version>
) {
  const status: SocksServerStatus = {
    socketInfo: getSocketInfo(socket),
    stateTracer: [globalServerState.startNegotiation],
  };
  const {stateTracer} = status;
  const {socksVersion, proxyConfigList} = config;
  try {
    const {requestTarget} = await getClientRequestTarget[socksVersion](socket, config, status);
    // const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'clientRequestInfo');
    if (!requestTarget) {
      throw createError(`Fail to get requestTarget`);
    }
    const {command} = requestTarget;
    if (command === ECommand.CONNECT) {
      stateTracer.push(globalServerState.gotClientRequest);
      const {socket: socket2Service, proxyClientStatus} = await connectToTargetServer[socksVersion](
        socket,
        {
          ...config,
        },
        status
      );
      status.socket2Service = socket2Service;
      status.proxyClientStatus = proxyClientStatus;
    } else {
      throw createError(`command ${command} not found`);
    }
    const {socket2Service} = status;
    socket2Service.once('close', () => {
      stateTracer.push(globalServerState.socket2ServiceClosed);
    });

    if (!socket || !socket2Service || socket.destroyed || socket2Service.destroyed) {
      throw createError(ERRORS.connectionError);
    }
    pipeline(socket, socket2Service, err => {
      // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
      // status.error = err;
      stateTracer.push(`${globalServerState.connectionError}: ${err?.message}`);
    });
    pipeline(socket2Service, socket, err => {
      // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
      // status.error = err;
      stateTracer.push(`${globalServerState.connectionError}: ${err?.message}`);
    });
    // }
    socket.resume();
    // status.stateTracer = serverserverState.success;
    stateTracer.push(globalServerState.finishNegotiation);
  } catch (err) {
    const {socket, socket2Service} = status;
    const {message = 'there is an error on socket server'} = err ?? {};
    socket2Service && socket2Service.writable && socket2Service.end(message);
    socket && socket.writable && socket.end(message);
    stateTracer.push(`${globalServerState.catchError}: ${message}`);
    // status.error = err;
  } finally {
    status.stateTracer = stateTracer;
  }

  return status;
}
