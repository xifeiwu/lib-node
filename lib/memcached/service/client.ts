import {TcpNetConnectOpts} from 'net';

export function getConnectionKey(options: TcpNetConnectOpts) {
  const {host, port} = options;
  return `${host}:${port}`;
}
