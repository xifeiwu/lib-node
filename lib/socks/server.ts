import {SocksServerStatus, SocksVersion, SocksServerConfig, SocksClientStatus} from './service/types';
import {Socket} from 'net';
import {pipeline} from 'stream';
import {connectToTargetServer, getTargetServiceInfo} from './v5/server';
import {serverState} from './service';
import {getSocketInfo} from './service/external';

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
  const stateTracer: SocksClientStatus['stateTracer'] = [serverState.startNegotiation];
  const status: SocksServerStatus = {
    socketInfo: getSocketInfo(socket),
  };
  try {
    const {stateTracer: tracerOfGetTargetServiceInfo = [], targetServiceInfo} = await getTargetServiceInfo(
      socket,
      config
    );
    stateTracer.push(...tracerOfGetTargetServiceInfo);
    stateTracer.push('get target service info success');
    const {socket: socket2Service, proxyClientInfo} = await connectToTargetServer(
      socket,
      targetServiceInfo,
      config,
      stateTracer
    );
    status.socket2Service = socket2Service;
    status.proxyClientInfo = proxyClientInfo;
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
