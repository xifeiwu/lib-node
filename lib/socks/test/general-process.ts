/** Show general process of each version */
import {watchSocketState, startHttpDebugServer} from '../service/external';
import {connectToSocksServer} from '../client';

import {logColorful} from '../../../log';
import {
  getSocksClientConfigV5,
  getSocksClientConfigVc1,
  httpRequestBuffer,
  startSocketServerForSocksV5,
  startSocketServerForSocksVc1,
} from './service';

export async function generalProcessV5() {
  // const socketServerInfo = await startSocksServerVc1();
  const socketServerInfo = await startSocketServerForSocksV5();
  const {host, port, server: socksServer} = socketServerInfo;
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  const status = await connectToSocksServer(getSocksClientConfigV5({host, port}, httpOrigin));
  const {socket} = status;
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  socket.write(httpRequestBuffer);
  await new Promise<void>((res, rej) => {
    socket.on('data', chunk => {
      console.log(chunk.toString());
      res();
    });
  });
  httpServer.close();
  // socksServer.close();
}

export async function generalProcessVc1() {
  const socketServerInfo = await startSocketServerForSocksVc1();
  const {host, port} = socketServerInfo;
  logColorful({}, 'start socks server:', {host, port});
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  const status = await connectToSocksServer(getSocksClientConfigVc1({host, port}, httpOrigin));
  const {socket} = status;
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  socket.write(httpRequestBuffer);
  await new Promise<void>((res, rej) => {
    socket.on('data', chunk => {
      console.log(chunk.toString());
      res();
    });
  });
  httpServer.close();
}
