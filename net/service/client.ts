import net, {NetConnectOpts, ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import tls from 'tls';
import {GetSocketOptions, HttpUpgradeConfig} from '../../types';
import {requestAndGetUpgradeInfo} from '../../http';
import {isNumber, isObject} from '../../external';

export function startSocketClient(options: NetConnectOpts, connectionListener?: () => void): Promise<Socket>;
export function startSocketClient(
  port: number,
  host?: string,
  connectionListener?: () => void
): Promise<Socket>;
export function startSocketClient(path: string, connectionListener?: () => void): Promise<Socket>;
export async function startSocketClient(...args) {
  return new Promise<Socket>((res, rej) => {
    const client = net.connect(...(args as [number, string]));
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
export function startTlsClient(
  options: NetConnectOpts,
  connectionListener?: () => void
): Promise<tls.TLSSocket>;
export function startTlsClient(
  port: number,
  host?: string,
  connectionListener?: () => void
): Promise<tls.TLSSocket>;
export function startTlsClient(path: string, connectionListener?: () => void): Promise<tls.TLSSocket>;
export async function startTlsClient(...args) {
  // {...mergedOptions, servername: mergedOptions.host}
  const finalArgs = [];
  if (args.length === 1) {
    // port or options
    const [arg] = args;
    if (isObject(arg)) {
      const {host} = arg;
      finalArgs.push({
        ...arg,
        servername: host,
      });
    } else {
      finalArgs.push(arg);
    }
  } else if (args.length == 2) {
    // [port, options]
    finalArgs.push(...args);
  } else if (args.length === 3) {
    // [port, host, options]
    const [port, host, options = {}] = args;
    finalArgs.push(port, host, {...options, servername: host});
  }
  return new Promise<tls.TLSSocket>((res, rej) => {
    const client = tls.connect(...(finalArgs as [number, string]));
    client.on('secureConnect', () => {
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
 * @deprecated Not sure whether this function is needed or not.
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
