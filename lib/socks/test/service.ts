import {
  startHttpServer,
  startTcpProxyServer,
  startSocketClient,
  tcpRequestPropsToBuffer,
  toBuffer,
} from '../service/external';
import {handleSocksConnection} from '../server';
import {
  AllSocksServerConfig,
  SocksClientConfig,
  SocksServerConfig,
  SocksServerInfo,
  SocksVersion,
  TargetSocksServer,
} from '../service/types';
import {EMethod, NegotiationInfoClient as NegotiationInfoClientV5, UserPassInfo} from '../service/types/v5';
import {RequestTarget} from '../service/types/base';
import {Socket} from 'net';
import {simplifySocksServerInfo, UPGRADE_PROTOCOL_SOCKS_PREFIX} from '../service';
import {logColorful} from '../../../log';
import {getUpgradeProtocol, getUpgradeResponse, responseInfoToBuffer} from '../../../http';

export const auth: UserPassInfo = {
  username: 'abc',
  password: 'dddd',
};

export async function startSocketServerForSocks(socksServerConfig: SocksServerConfig<any>) {
  const infoList: SocksServerInfo[] = [];
  const httpServerInfo = await startHttpServer(
    {
      request(req, res) {
        res.setHeader('content-type', 'application/json');
        const data = toBuffer([infoList.map(simplifySocksServerInfo)]);
        res.end(data);
      },
    },
    {
      host: '127.0.0.1',
    }
  );
  const socksHandler = async (socket: Socket) => {
    logColorful({color: 'red'}, `handle sockeet for ${socksServerConfig.socksVersion}`);
    const info = await handleSocksConnection(socket, socksServerConfig);
    if (infoList.length > 200) {
      infoList.pop();
    }
    infoList.unshift(info);
  };
  const httpHandler = async (socket: Socket) => {
    const {host, port} = httpServerInfo;
    const proxyClient = await startSocketClient({host, port});
    socket.pipe(proxyClient).pipe(socket);
  };

  return await startTcpProxyServer({
    tcpHandler: socksHandler,
    httpHandler,
  });
}

export function getSocksServerConfigV5(config?: Partial<SocksServerConfig<5>>) {
  const socksServerConfig: SocksServerConfig<5> = {
    socksVersion: 5,
    methodList: [{method: EMethod.NoAuth}],
    ...(config ?? {}),
  };
  return socksServerConfig;
}

export function getSocksServerConfigVc1(config?: Partial<SocksServerConfig<1>>) {
  const socksServerConfig: SocksServerConfig<1> = {socksVersion: 1, auth: auth, ...(config ?? {})};
  return socksServerConfig;
}

export async function runSocksOnTcpServer(socksServerConfig: Partial<AllSocksServerConfig>) {
  const infoList: SocksServerInfo[] = [];
  const httpServerInfo = await startHttpServer(
    {
      request(req, res) {
        res.setHeader('content-type', 'application/json');
        const data = toBuffer([infoList.map(simplifySocksServerInfo)]);
        res.end(data);
      },
    },
    {
      host: '127.0.0.1',
    }
  );
  const handleAsSocks = async (socket: Socket, firstChunk: Buffer) => {
    const firstByte = firstChunk[0];
    const socksConfig = socksServerConfig[firstByte];
    if (!socksConfig) {
      return false;
    }
    logColorful({color: 'red'}, `handle sockeet for ${socksConfig.socksVersion}`);
    const info = await handleSocksConnection(socket, socksConfig);
    if (infoList.length > 200) {
      infoList.pop();
    }
    infoList.unshift(info);
  };
  const tcpHandler = async (socket: Socket, firstChunk: Buffer) => {
    return handleAsSocks(socket, firstChunk);
  };
  const httpHandler = async (socket: Socket) => {
    const {host, port} = httpServerInfo;
    const proxyClient = await startSocketClient({host, port});
    socket.pipe(proxyClient).pipe(socket);
  };
  const tcpServerInfo = await startTcpProxyServer({
    tcpHandler,
    httpHandler,
  });
  return tcpServerInfo;
}

export async function startSocketServerForSocksV5(config?: Partial<SocksServerConfig<5>>) {
  const socksServerConfig: SocksServerConfig<5> = {
    socksVersion: 5,
    methodList: [{method: EMethod.NoAuth}],
    ...(config ?? {}),
  };
  return startSocketServerForSocks(socksServerConfig);
}
export function getSocksClientConfigV5(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<5> = {
    socksVersion: 5,
    methodList: [{method: EMethod.NoAuth}, {method: EMethod.UserPass, info: auth}],
    socksServer,
    requestTarget,
  };
  return info;
}

export function getSocksClientConfigVc1(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<1> = {
    socksVersion: 1,
    auth,
    socksServer,
    requestTarget,
  };
  return info;
}

export const httpRequestBuffer = tcpRequestPropsToBuffer({
  method: 'post',
  url: '/api/test',
  data: {a: 1},
});

export async function startHttpServerForSocks(socksServerConfig: SocksServerConfig<any>) {
  const infoList: SocksServerInfo[] = [];
  const httpServerInfo = await startHttpServer(
    {
      request(req, res) {
        res.setHeader('content-type', 'application/json');
        const data = toBuffer([infoList.map(simplifySocksServerInfo)]);
        res.end(data);
      },
      async upgrade(req, socket) {
        const protocol = getUpgradeProtocol(req);
        if (protocol === UPGRADE_PROTOCOL_SOCKS_PREFIX) {
          socket.write(responseInfoToBuffer(getUpgradeResponse(protocol)));
        }

        logColorful({color: 'red'}, `handle sockeet for ${socksServerConfig.socksVersion}`);
        const info = await handleSocksConnection(socket, socksServerConfig);
        if (infoList.length > 200) {
          infoList.pop();
        }
        infoList.unshift(info);
      },
    },
    {
      host: '127.0.0.1',
    }
  );
  return httpServerInfo;
}

export async function startHttpServerForSocksV5(config?: Partial<SocksServerConfig<5>>) {
  const socksServerConfig: SocksServerConfig<5> = {
    socksVersion: 5,
    methodList: [{method: EMethod.NoAuth}],
    ...(config ?? {}),
  };
  return startHttpServerForSocks(socksServerConfig);
}

export async function startHttpServerForSocksVc1(config?: Partial<SocksServerConfig<1>>) {
  const socksServerConfig: SocksServerConfig<1> = {socksVersion: 1, auth: auth, ...(config ?? {})};
  return startHttpServerForSocks(socksServerConfig);
}
