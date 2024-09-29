import {
  getRequestInfo,
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
import {handleConnection} from '../../server';
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
  const {port: httpPort} = await startHttpServer(
    {
      async request(request, response) {
        const requestInfo = await getRequestInfo(request);
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
      handleConnection(socket, {socksVersion: 'v6', auth});
      watchSocketState(socket, {colorStyle: {color: 'blue'}});
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
    targetSocksServer: socksServer2,
  };
  const socksServer1 = await startSocketServer(
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
      targetSocksServer: socksServer1,
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
      socksVersion: 'v6',
      auth,
      targetSocksServer: socksServer1,
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
