import {startHttpDebugServer} from '../../../../http';
import {connectToSocksServer} from '../../client';
import {handleConnection} from '../../server';
import {PORT, startSocketServer, tcpRequestPropsToBuffer} from '../../service/external';
import {SocksProxyConfig} from '../../service/types';
import {EMethod, MethodUserPass} from '../../service/types/v5';
// import {connectToSocksServer} from '../../v5/client';
// import {handleConnection} from '../../v5/server';

export async function generalProcess() {
  const {origin: httpOrigin, server} = await startHttpDebugServer();
  const {host, port} = await startSocketServer(socket => {
    handleConnection(socket, {socksVersion: 'v5', methodList: [{method: EMethod.NoAuth}]});
  });
  const status = await connectToSocksServer({
    socksVersion: 'v5',
    targetSocksServer: {host, port},
    clientRequestInfo: httpOrigin,
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
    handleConnection(socket, {socksVersion: 'v5', methodList: [methodUsePass]});
  });
  const status = await connectToSocksServer({
    socksVersion: 'v5',
    methodList: [methodUsePass],
    targetSocksServer: {host, port},
    clientRequestInfo: httpOrigin,
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
  let startPort = PORT.start3400.port;
  const {
    origin: httpOrigin,
    port: httpPort,
    server,
  } = await startHttpDebugServer({
    port: startPort++,
  });
  const methodUsePass: MethodUserPass = {
    method: EMethod.UserPass,
    info: {
      username: 'abc',
      password: 'ddd',
    },
  };
  const {host: host2, port: port2} = await startSocketServer(
    socket => {
      handleConnection(socket, {socksVersion: 'v5', methodList: [methodUsePass]});
    },
    {
      port: startPort++,
    }
  );
  const proxyToV5: SocksProxyConfig<'v5'> = {
    socksVersion: 'v5',
    matches: [/127.0.0.1/],
    methodList: [methodUsePass],
    targetSocksServer: {
      host: host2,
      port: port2,
    },
  };
  const {host: host1, port: port1} = await startSocketServer(
    socket => {
      handleConnection(socket, {
        socksVersion: 'v5',
        proxyConfigList: [proxyToV5],
      });
    },
    {
      port: startPort++,
    }
  );
  {
    const status = await connectToSocksServer({
      socksVersion: 'v5',
      targetSocksServer: {host: host1, port: port1},
      clientRequestInfo: {
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
      socksVersion: 'v5',
      targetSocksServer: {host: host1, port: port1},
      clientRequestInfo: {
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
