import {
  SocksServerStatus,
  SocksVersion,
  SocksServerConfig,
  SocksClientStatus,
  SocksServerNegotiationInfoV6,
  GetClientRequestInfoFunc,
  ECommand,
  ConnectToTargetServerFunc,
} from './service/types';
import {Socket} from 'net';
import {pipeline} from 'stream';
import {ERRORS, createError, getInfoFromStateTracer, globalServerState} from './service';
import {getSocketInfo} from './service/external';
import {
  getClientRequestInfo as getClientRequestInfoV5,
  connectToTargetServer as connectToTargetServerV5,
} from './v5/server';
import {
  getClientRequestInfo as getClientRequestInfoV6,
  connectToTargetServer as connectToTargetServerV6,
} from './v6/server';

const getClientRequestInfo: {
  [version in SocksVersion]: GetClientRequestInfoFunc<SocksVersion>;
} = {
  v5: getClientRequestInfoV5,
  v6: getClientRequestInfoV6,
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
    // if (socksVersion === 'v5') {
    //   await getClientRequestInfoV5(
    //     socket,
    //     {
    //       ...config,
    //     },
    //     status
    //   );
    // } else if (socksVersion === 'v6') {
    //   await getClientRequestInfoV6(
    //     socket,
    //     {
    //       ...config,
    //     } as SocksServerNegotiationInfoV6,
    //     status
    //   );
    // }
    const {clientRequestInfo} = await getClientRequestInfo[socksVersion](socket, config, status);
    // const clientRequestInfo = getInfoFromStateTracer(stateTracer, 'clientRequestInfo');
    if (!clientRequestInfo) {
      throw createError(ERRORS.CLIENT_AUTH_FAIL);
    }

    // const proxyStatus = proxyConfigList && (await proxySocksRequest(clientRequestInfo, proxyConfigList));
    //   const {
    //     stateTracer: tracer = [],
    //     proxyClientInfo: {repliedServiceInfo, socket: proxySocket},
    //   } = proxyStatus;
    //   stateTracer.push(...tracer);
    //   const replied = {
    //     reply: ETargetServiceConnectState.succeeded,
    //     ...(repliedServiceInfo ?? {address: '8.8.8.8', port: 88}),
    //   };
    //   await serverReplyTargetServiceInfo(socket, replied);
    //   stateTracer.push(serverState.repliedTargetServiceInfo);
    //   stateTracer.push({
    //     key: 'repliedServiceInfo',
    //     value: replied,
    //   });
    //   socket2Service = proxySocket;

    const {command} = clientRequestInfo;
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
