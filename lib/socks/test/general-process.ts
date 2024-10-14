/** Show general process of each version */
import {watchSocketState, startHttpDebugServer} from '../service/external';
import {connectToSocksServer} from '../client';

import {logColorful} from '../../../log';
import {
  getSocksClientConfigV5,
  getSocksClientConfigVc1,
  getSocksServerConfigV5,
  getSocksServerConfigVc1,
  httpRequestBuffer,
  startTcpServerForSocks,
} from './service';
import {SocksClientConfig} from '..';

async function startSocksServer() {
  return await startTcpServerForSocks({
    5: getSocksServerConfigV5(),
    1: getSocksServerConfigVc1(),
  });
}

async function conectAndShowFirstChunk(clientSocksConfig: SocksClientConfig) {
  const status = await connectToSocksServer(clientSocksConfig);
  const {socket} = status;
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  socket.write(httpRequestBuffer);
  await new Promise<void>((res, rej) => {
    socket.on('data', chunk => {
      console.log(chunk.toString());
      res();
    });
  });
}
export async function generalProcessV5() {
  const {host, port, server: socksServer} = await startSocksServer();
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  await conectAndShowFirstChunk(getSocksClientConfigV5({host, port}, httpOrigin));
  httpServer.close();
}

export async function generalProcessVc1() {
  const {host, port, server: socksServer} = await startSocksServer();
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  await conectAndShowFirstChunk(getSocksClientConfigVc1({host, port}, httpOrigin));
  httpServer.close();
}

export async function generalProcessAll() {
  const {host, port, server: socksServer} = await startSocksServer();
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  await conectAndShowFirstChunk(getSocksClientConfigV5({host, port}, httpOrigin));
  await conectAndShowFirstChunk(getSocksClientConfigVc1({host, port}, httpOrigin));
  httpServer.close();
}
