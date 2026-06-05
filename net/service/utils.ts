import {NetConnectOpts, Socket} from 'net';
import {startSocketClient} from './client';

/**
 * pipe current socket to target address, and handle socket connection on both sides
 */
export async function pipeSocketToTarget(socket: Socket, options: NetConnectOpts) {
  try {
    const proxySocket = await startSocketClient(options);
    const destroyBoth = (err?: Error) => {
      if (!socket.destroyed) socket.destroy(err);
      if (!proxySocket.destroyed) proxySocket.destroy(err);
    };
    socket.on('error', destroyBoth);
    proxySocket.on('error', destroyBoth);
    socket.on('close', () => proxySocket.destroy());
    proxySocket.on('close', () => socket.destroy());
    socket.pipe(proxySocket);
    proxySocket.pipe(socket);
  } catch (error) {
    socket.destroy();
  }
}
