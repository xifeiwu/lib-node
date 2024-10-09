import { logColorful } from '../../../../log';
import {connectToSocksServer} from '../../client';
import {handleConnection} from '../../server';
import {PORT, startHttpDebugServer, startSocketServer, tcpRequestPropsToBuffer} from '../../service/external';
import {SocksProxyConfig} from '../../service/types';
import {EMethod, MethodUserPass} from '../../service/types/v5';
import {eorBuffer, getCipher} from '../../vc1/service';

export async function generalProcess() {
  const {origin: httpOrigin, server} = await startHttpDebugServer({port: PORT.fullFeatureHttpServer.port,});
  const {host, port} = await startSocketServer(socket => {
    handleConnection(socket, {socksVersion: 'v5', methodList: [{method: EMethod.NoAuth}]});
  });
  const status = await connectToSocksServer({
    socksVersion: 'v5',
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
      tcpRequestPropsToBuffer({
        method: 'post',
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
    socksServer: {host, port},
    requestTarget: httpOrigin,
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
    socksServer: {
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
      socksServer: {host: host1, port: port1},
      requestTarget: {
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
      socksServer: {host: host1, port: port1},
      requestTarget: {
        address: '127.0.0.1',
        port: httpPort,
      },
    });

    const {socket, stateTracer} = status;
    const iv = getInfoFromStateTracer(stateTracer, 'iv');
    // toReadable()
    socket.write(
      eorBuffer(
        tcpRequestPropsToBuffer({
          method: 'post',
          data: {to: '127.0.0.1'},
        }),
        iv
      )
    );
    socket.on('data', chunk => {
      console.log(chunk.toString());
    });
  }
}
