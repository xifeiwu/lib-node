import {logColorful} from '../../../../log';
import {connectToSocksServer} from '../../client';
import {handleSocksConnection} from '../../server';
import {SOCKS_AUTH_DEFAULT_USER_PASS} from '../../service';
import {PORT, startHttpDebugServer, startSocketServer, httpRequestInfoToBuffer} from '../../service/external';
import {EMethod, MethodUserPass} from '../../types/v5';

export async function generalProcess() {
  const {origin: httpOrigin, server} = await startHttpDebugServer({port: PORT.stableHttpServer.port});
  const {host, port} = await startSocketServer(socket => {
    handleSocksConnection(socket, {socksVersion: 5, methodList: [{method: EMethod.NoAuth}]});
  });
  const status = await connectToSocksServer({
    socksVersion: 5,
    socksServer: {host, port},
    requestTarget: httpOrigin,
  });
  const {socket} = status;

  socket.on('data', chunk => {
    logColorful({color: 'blue'}, chunk.toString());
  });
  let cnt = 0;
  while (cnt++ < 3) {
    socket.write(
      httpRequestInfoToBuffer({
        method: 'post',
        url: '/',
        data: {a: cnt},
        headers: {
          connection: 'keep-alive',
        },
      })
    );
  }
}

/**
 * cases:
 * Will throw error when MethodUserPass is not correct on client side
 */
export async function useAuthUserPass() {
  const {origin: httpOrigin, server} = await startHttpDebugServer();
  const methodUsePass: MethodUserPass = {
    method: EMethod.UserPass,
    info: SOCKS_AUTH_DEFAULT_USER_PASS,
  };
  const {host, port} = await startSocketServer(socket => {
    handleSocksConnection(socket, {socksVersion: 5, methodList: [methodUsePass]});
  });
  const status = await connectToSocksServer({
    socksVersion: 5,
    methodList: [methodUsePass],
    socksServer: {host, port},
    requestTarget: httpOrigin,
  });
  const {socket} = status;
  socket.write(
    httpRequestInfoToBuffer({
      method: 'post',
      url: '/',
      data: {a: 1},
    })
  );
  socket.on('data', chunk => {
    console.log(chunk.toString());
  });
}
