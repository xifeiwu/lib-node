import {startHttpDebugServer} from '../../../../http';
import {startSocketServer, tcpRequestPropsToBuffer} from '../../service/external';
import {EMethod, MethodUserPass} from '../../service/types/v5';
import {connectToSocksServer} from '../../v5/client';
import {handleConnection} from '../../v5/server';

export async function generalProcess() {
  const {origin: httpOrigin, server} = await startHttpDebugServer();
  const {host, port} = await startSocketServer(socket => {
    handleConnection(socket, {methodList: [{method: EMethod.NoAuth}]});
  });
  const status = await connectToSocksServer({
    targetSocksServer: {host, port},
    targetServiceInfo: httpOrigin,
  });
  const {socket} = status;
  socket.write(
    tcpRequestPropsToBuffer({
      method: 'post',
      data: {a: 1},
    })
  );
  socket.on('data', chunk => {
    console.log(chunk.toString());
  });
}

/**
 * cases:
 * Will throw error when MethodUserPass is not correct on client side
 */
export async function useAuthUserPass() {
  const {origin: httpOrigin, server} = await startHttpDebugServer();
  const methodUsePass: MethodUserPass = {
    method: EMethod.UserPass,
    info: {
      username: 'abc',
      password: 'ddd',
    },
  };
  const {host, port} = await startSocketServer(socket => {
    handleConnection(socket, {methodList: [methodUsePass]});
  });
  const status = await connectToSocksServer({
    methodList: [methodUsePass],
    targetSocksServer: {host, port},
    targetServiceInfo: httpOrigin,
  });
  const {socket} = status;
  socket.write(
    tcpRequestPropsToBuffer({
      method: 'post',
      data: {a: 1},
    })
  );
  socket.on('data', chunk => {
    console.log(chunk.toString());
  });
}

export async function proxyRequestOnServerSide() {
  const {origin: httpOrigin, port: httpPort, server} = await startHttpDebugServer();
  const methodUsePass: MethodUserPass = {
    method: EMethod.UserPass,
    info: {
      username: 'abc',
      password: 'ddd',
    },
  };
  const {host: host2, port: port2} = await startSocketServer(socket => {
    handleConnection(socket, {methodList: [methodUsePass]});
  });
  const {host: host1, port: port1} = await startSocketServer(socket => {
    handleConnection(socket, {
      proxyConfigList: [
        {
          matches: [/127.0.0.1/],
          // @ts-ignore
          methodList: [methodUsePass],
          targetSocksServer: {
            host: host2,
            port: port2,
          },
        },
      ],
    });
  });
  {
    const status = await connectToSocksServer({
      targetSocksServer: {host: host1, port: port1},
      targetServiceInfo: {
        address: '0.0.0.0',
        port: httpPort,
      },
    });
    const {socket} = status;
    socket.write(
      tcpRequestPropsToBuffer({
        method: 'post',
        data: {to: '0.0.0.0'},
      })
    );
    socket.on('data', chunk => {
      console.log(chunk.toString());
    });
  }
  {
    const status = await connectToSocksServer({
      targetSocksServer: {host: host1, port: port1},
      targetServiceInfo: {
        address: '127.0.0.1',
        port: httpPort,
      },
    });

    const {socket} = status;
    socket.write(
      tcpRequestPropsToBuffer({
        method: 'post',
        data: {to: '127.0.0.1'},
      })
    );
    socket.on('data', chunk => {
      console.log(chunk.toString());
    });
  }
}
