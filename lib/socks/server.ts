import {SocksServerInfo, SocksVersion, SocksServerConfig, SocksClientInfo} from './service/types';
import {Socket} from 'net';
import {pipeline} from 'stream';
import {serverState} from './service';
import {getSocketInfo} from './service/external';
import {
  getClientRequest as getTargetServiceInfoV5,
  connectToTargetServer as connectToTargetServerV5,
} from './v5/server';

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
  const status: SocksServerInfo = {
    socketInfo: getSocketInfo(socket),
    stateTracer: [serverState.startNegotiation],
  };
  const {stateTracer} = status;
  const {socksVersion} = config;
  try {
    if (socksVersion === 'v5') {
      const {clientRequest: targetServiceInfo} = await getTargetServiceInfoV5(
        socket,
        {
          ...config,
          socksVersion: 'v5',
        },
        status
      );
      // stateTracer.push(...tracerOfGetTargetServiceInfo);
      stateTracer.push('get target service info success');

      const {socket: socket2Service, proxyClientInfo} = await connectToTargetServerV5(
        socket,
        targetServiceInfo,
        {
          ...config,
          socksVersion: 'v5',
        },
        status
      );
      status.socket2Service = socket2Service;
      status.proxyClientInfo = proxyClientInfo;
    }
    const {socket2Service} = status;
    socket2Service.once('close', () => {
      stateTracer.push(serverState.socket2ServiceClosed);
    });

    if (socket.writable && socket2Service.writable) {
      pipeline(socket, socket2Service, err => {
        // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
        // status.error = err;
        stateTracer.push(`${serverState.connectionError}: ${err?.message}`);
      });
      pipeline(socket2Service, socket, err => {
        // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
        // status.error = err;
        stateTracer.push(`${serverState.connectionError}: ${err?.message}`);
      });
      // }
      socket.resume();
      // status.stateTracer = serverserverState.success;
      stateTracer.push(serverState.finishNegotiation);
    } else {
      !socket.writable && stateTracer.push(`${serverState.connectionError}: client socket unwritable`);
      !socket2Service.writable &&
        stateTracer.push(`${serverState.connectionError}: target service socket unwritable`);
    }
  } catch (err) {
    const {socket, socket2Service} = status;
    const {message = 'there is an error on socket server'} = err ?? {};
    socket2Service && socket2Service.writable && socket2Service.end(message);
    socket && socket.writable && socket.end(message);
    stateTracer.push(`${serverState.catchError}: ${message}`);
    // status.error = err;
  } finally {
    status.stateTracer = stateTracer;
  }

  return status;
}
