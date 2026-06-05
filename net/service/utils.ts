import {NetConnectOpts, Socket} from 'net';
import {startSocketClient} from './client';

/**
 * Close the socket after idleTimeoutMs of inactivity (no send or receive).
 * No-op when idleTimeoutMs is not a positive number.
 */
export function applyIdleTimeout(socket: Socket, idleTimeoutMs?: number) {
  if (!idleTimeoutMs || idleTimeoutMs <= 0) {
    return;
  }
  socket.setTimeout(idleTimeoutMs);
  socket.on('timeout', () => {
    socket.destroy();
  });
}

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
