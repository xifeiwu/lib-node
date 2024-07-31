import {connectToSocksServer} from '../../client';
import {handleConnection} from '../../server';
import {PORT, startHttpDebugServer, startSocketServer, tcpRequestPropsToBuffer} from '../../service/external';
import {SocksProxyConfig} from '../../service/types';

export async function generalProcess() {
  const auth = {
    username: 'abc',
    password: 'dddd',
  };
  const {origin: httpOrigin, server} = await startHttpDebugServer();
  const {host, port} = await startSocketServer(socket => {
    handleConnection(socket, {socksVersion: 'v6', auth});
  });
  const status = await connectToSocksServer({
    socksVersion: 'v6',
    auth,
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
  let startPort = PORT.start3400.port;
  const {
    origin: httpOrigin,
    port: httpPort,
    server,
  } = await startHttpDebugServer({
    port: startPort++,
  });
  // const methodUsePass: MethodUserPass = {
  //   method: EMethod.UserPass,
  //   info: ,
  // };
  const auth = {
    username: 'abc',
    password: 'ddd',
  };
  const {host: host2, port: port2} = await startSocketServer(
    socket => {
      handleConnection(socket, {socksVersion: 'v6', auth});
    },
    {
      port: startPort++,
    }
  );
  const proxyToV6: SocksProxyConfig<'v6'> = {
    matches: [/127.0.0.1/],
    socksVersion: 'v6',
    // methodList: [methodUsePass],
    auth,
    targetSocksServer: {
      host: host2,
      port: port2,
    },
  };
  const {host: host1, port: port1} = await startSocketServer(
    socket => {
      handleConnection(socket, {
        auth,
        socksVersion: 'v6',
        proxyConfigList: [proxyToV6],
      });
    },
    {
      port: startPort++,
    }
  );
  {
    const status = await connectToSocksServer({
      socksVersion: 'v6',
      auth,
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
      socksVersion: 'v6',
      auth,
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
