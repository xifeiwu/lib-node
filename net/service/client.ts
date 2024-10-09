import net, {NetConnectOpts, ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import {GetSocketOptions, HttpUpgradeConfig} from '../../types';
import {requestAndGetUpgradeInfo} from '../../http';

export function startSocketClient(options: NetConnectOpts, connectionListener?: () => void): Promise<Socket>;
export function startSocketClient(
  port: number,
  host?: string,
  connectionListener?: () => void
): Promise<Socket>;
export function startSocketClient(path: string, connectionListener?: () => void): Promise<Socket>;
export async function startSocketClient(...args) {
  return new Promise<Socket>((res, rej) => {
    const client = net.createConnection(...(args as [number, string]));
    client.on('ready', () => {
      res(client);
    });
    client.on('error', err => {
      rej(err);
    });
    client.on('timeout', () => {
      rej('timeout');
    });
  });
}

/**
 * Not sure whether this function is needed or not.
 * @param options
 * @returns
 */
export async function getClientSocket(options: GetSocketOptions) {
  let socket: Socket = options as Socket;
  if (Object.prototype.hasOwnProperty.call(options, 'href')) {
    const {href, upgrade} = options as HttpUpgradeConfig;
    const {socket: _socket} = await requestAndGetUpgradeInfo({
      url: href,
      headers: {
        Connection: 'Upgrade',
        Upgrade: upgrade,
      },
    });
    socket = _socket;
  } else {
    socket = await startSocketClient(options as NetConnectOpts);
  }
  return socket;
}
