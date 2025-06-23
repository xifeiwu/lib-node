import {
  SocksServerInfo,
  SocksVersion,
  SocksServerConfig,
  NegotiationWithClient,
  ServerConfig,
  SendRequestTargetResponse,
} from './types';
import {Socket} from 'net';
import {pipeline} from 'stream';
import {ERRORS, createError, SERVER_STATE, pushState, serializeErrorInfo} from './';
import {
  negotiation as negotiationV5,
  sendRequestTargetResponse as sendRequestTargetResponseV5,
} from './v5/server';
import {
  negotiation as negotiationVc1,
  sendRequestTargetResponse as sendRequestTargetResponseVc1,
} from './vc1/server';
import {ECommand, RequestTargetV5} from './types/v5';
import {handleConnectCommand} from './proxy';
import {getWrapSocketFunc} from './service/common';

/**
 * Two phases on server side:
 * 1. negotiation with client, get RequestTarget
 * 2. handle RequestTarget
 * 3. response RequestTarget in format of requestTargetResponse
 */
const negotiationWithClient: {
  [version in SocksVersion]: NegotiationWithClient<SocksVersion>;
} = {
  5: negotiationV5,
  1: negotiationVc1,
};

const sendRequestTargetResponse: {
  [version in SocksVersion]: SendRequestTargetResponse<SocksVersion>;
} = {
  5: sendRequestTargetResponseV5,
  1: sendRequestTargetResponseVc1,
};

/**
 * Handle new connection on sock server side
 * Close socket on socket error events of any error thrown during the logic process
 */
export async function handleSocksConnection<Version extends SocksVersion>(
  socket: Socket,
  config: SocksServerConfig<Version>,
  handleRequestTarget?: (requestTarget: RequestTargetV5) => Promise<boolean | undefined>
) {
  const {socksVersion, proxyConfigList, ...serverConfig} = config;
  const info: SocksServerInfo = {
    socksVersion,
    negotiationResult: undefined,
    stateTracer: [SERVER_STATE.startHandleConnection],
  };
  const {stateTracer} = info;
  try {
    pushState(SERVER_STATE.startNegotiation, stateTracer);
    const negotiationResult = await negotiationWithClient[socksVersion](socket, serverConfig, stateTracer);
    info.negotiationResult = negotiationResult;
    const {requestTarget} = negotiationResult;
    if (!requestTarget) {
      throw createError(`Fail to get requestTarget`);
    }
    const {command} = requestTarget;
    if (command === ECommand.CONNECT) {
      stateTracer.push(SERVER_STATE.handleConnectCommand);
      const {
        socket: socket2Remote,
        requestTargetResponse,
        socksClientInfo,
      } = await handleConnectCommand(requestTarget, {proxyConfigList, stateTracer});
      await sendRequestTargetResponse[socksVersion](socket, requestTargetResponse, negotiationResult);

      info.socket2Remote = socket2Remote;
      info.socksClientInfo = socksClientInfo;
      if (socket2Remote) {
        socket2Remote.once('close', () => {
          stateTracer.push(SERVER_STATE.remoteSocketClosed);
        });
      }

      if (!socket || !socket2Remote || socket.destroyed || socket2Remote.destroyed) {
        throw createError(ERRORS.connectionError);
      }
      // if (socksVersion === 'vc1') {
      //   socket.on('data', chunk => {
      //     console.log(`chunk.toString()`);
      //     console.log(chunk.toString());
      //   })
      //   socket2Remote.on('data', chunk => {
      //     console.log(`socket2Remote chunk.toString()`);
      //     console.log(chunk.toString());
      //   })
      // }
      const wrappedSocket = getWrapSocketFunc(socksVersion)(socket, negotiationResult);
      pipeline(wrappedSocket, socket2Remote, err => {
        // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
        // status.error = err;
        stateTracer.push(`${SERVER_STATE.connectionError}: ${err?.message}`);
      });
      pipeline(socket2Remote, wrappedSocket, err => {
        // status.stateTracer = serverserverState.socket_connect_between_client_target_fail;
        // status.error = err;
        stateTracer.push(`${SERVER_STATE.connectionError}: ${err?.message}`);
      });
      socket.resume();
      // // When client ends, we stop writing to target
      // wrappedSocket.on('end', () => {
      //   socket2Remote.end(); // Half-close target socket
      // });
      // // On error, destroy both sockets
      // wrappedSocket.on('error', () => {
      //   socket2Remote.destroy();
      // });
      // // When target ends, we stop writing to client
      // socket2Remote.on('end', () => {
      //   wrappedSocket.end(); // Half-close client socket
      // });
      // socket2Remote.on('error', () => {
      //   wrappedSocket.destroy();
      // });
      // status.stateTracer = serverserverState.success;
      stateTracer.push(SERVER_STATE.handleConnectCommandSuccess);
    } else if (command === ECommand.ECHO) {
      stateTracer.push(SERVER_STATE.handleConnectCommand);
      await sendRequestTargetResponse[socksVersion](
        socket,
        {
          reply: 0,
          address: '0.0.0.0',
          port: 80,
        },
        negotiationResult
      );
      socket.resume();
      socket.on('data', chunk => {
        if (socket.writable) {
          socket.write(chunk);
        }
      });
    } else {
      throw createError(`command ${command} not found`);
    }
  } catch (err) {
    info.error = err;
    const {socket2Remote} = info;
    const {message = 'there is an error on socket server'} = err ?? {};
    socket2Remote && socket2Remote.writable && socket2Remote.end(message);
    const isSocketActive = socket && socket.writable;
    if (isSocketActive) {
      socket.end(message);
    }
    stateTracer.push(`${SERVER_STATE.catchError}: ${JSON.stringify(serializeErrorInfo(err))}`);
  } finally {
    info.stateTracer = stateTracer;
  }
  return info;
}
