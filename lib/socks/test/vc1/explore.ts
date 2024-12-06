import {
  getHttpRequestInfo,
  getSocketInfo,
  startHttpServer,
  toBuffer,
  watchSocketState,
  PORT,
  startHttpDebugServer,
  startSocketServer,
  tcpRequestPropsToBuffer,
} from '../../service/external';
import {connectToSocksServer} from '../../client';
import {handleSocksConnection} from '../../server';
import {SocksProxyConfig, SocksServerConfig} from '../../types';

export async function generalProcess() {
  const auth = {
    username: 'abc',
    password: 'dddd',
  };
  const {origin: httpOrigin, server: httpServer} = await startHttpDebugServer();
  const socksServerConfig: SocksServerConfig<1> = {socksVersion: 1, auth};
  const {host, port} = await startSocketServer(socket => {
    handleSocksConnection(socket, socksServerConfig);
  });
  const status = await connectToSocksServer({
    socksVersion: 1,
    auth,
    socksServer: {host, port},
    requestTarget: httpOrigin,
  });
  const {socket} = status;
  watchSocketState(socket, {colorStyle: {color: 'blue'}});
  socket.write(
    tcpRequestPropsToBuffer({
      method: 'post',
      url: 'api/test',
      data: {a: 1},
    })
  );
  await new Promise<void>((res, rej) => {
    socket.on('data', chunk => {
      console.log(chunk.toString());
      res();
    });
  });
  httpServer.close();
}

export async function proxyToOtherSocksServer() {
  let startPort = PORT.start3400.port;
  const {port: httpPort} = await startHttpServer(
    {
      async request(request, response) {
        const requestInfo = await getHttpRequestInfo(request);
        const resData = toBuffer({...requestInfo, socketInfo: getSocketInfo(request.socket)});
        response.setHeader['content-length'] = resData.byteLength;
        response.setHeader['content-type'] = 'application/json';
        response.end(resData);
      },
    },
    {
      port: startPort++,
    }
  );
  const auth = {
    username: 'abc',
    password: 'ddd',
  };
  const socksServer2 = await startSocketServer(
    socket => {
      handleSocksConnection(socket, {socksVersion: 1, auth});
      watchSocketState(socket, {colorStyle: {color: 'blue'}});
    },
    {
      port: startPort++,
    }
  );
  const proxyToV6: SocksProxyConfig<1> = {
    matches: [/127.0.0.1/],
    socksVersion: 1,
    auth,
    socksServer: socksServer2,
  };
  const socksServer1 = await startSocketServer(
    socket => {
      handleSocksConnection(socket, {
        auth,
        socksVersion: 1,
        proxyConfigList: [proxyToV6],
      });
    },
    {
      port: startPort++,
    }
  );
  {
    const status = await connectToSocksServer({
      socksVersion: 1,
      auth,
      socksServer: socksServer1,
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
    await new Promise<void>(res => {
      socket.on('data', chunk => {
        console.log(chunk.toString());
        res();
      });
    });
  }
  {
    const status = await connectToSocksServer({
      socksVersion: 1,
      auth,
      socksServer: socksServer1,
      requestTarget: {
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
