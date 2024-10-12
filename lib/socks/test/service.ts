import {
  startHttpServer,
  startRedirectSocketServer,
  startSocketClient,
  startSocketServer,
  convertToBuffer,
  tcpRequestPropsToBuffer,
  toBuffer,
} from '../service/external';
import {handleConnection} from '../server';
import {SocksClientConfig, SocksServerConfig, SocksServerInfo, TargetSocksServer} from '../service/types';
import {EMethod, NegotiationInfoClient as NegotiationInfoClientV5, UserPassInfo} from '../service/types/v5';
import {RequestTarget} from '../service/types/base';
import {Socket} from 'net';
import {simplifySocksServerInfo, UPGRADE_PROTOCOL_SOCKS} from '../service';
import {logColorful} from '../../../log';
import {getUpgradeProtocol, getUpgradeResponse, responseInfoToBuffer} from '../../../http';

export const auth: UserPassInfo = {
  username: 'abc',
  password: 'dddd',
};

async function startSocketServerForSocks(socksServerConfig: SocksServerConfig<any>) {
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
    const info = await handleConnection(socket, socksServerConfig);
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

  return await startRedirectSocketServer({
    tcpHandler: socksHandler,
    httpHandler,
  });
}
export async function startSocketServerForSocksV5(config?: Partial<SocksServerConfig<'v5'>>) {
  const socksServerConfig: SocksServerConfig<'v5'> = {
    socksVersion: 'v5',
    methodList: [{method: EMethod.NoAuth}],
    ...(config ?? {}),
  };
  return startSocketServerForSocks(socksServerConfig);
}
export function getSocksClientConfigV5(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<'v5'> = {
    socksVersion: 'v5',
    methodList: [{method: EMethod.NoAuth}, {method: EMethod.UserPass, info: auth}],
    socksServer,
    requestTarget,
  };
  return info;
}

export async function startSocketServerForSocksVc1(config?: Partial<SocksServerConfig<'vc1'>>) {
  const socksServerConfig: SocksServerConfig<'vc1'> = {socksVersion: 'vc1', auth: auth, ...(config ?? {})};
  return startSocketServerForSocks(socksServerConfig);
}
export function getSocksClientConfigVc1(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<'vc1'> = {
    socksVersion: 'vc1',
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
        if (protocol === UPGRADE_PROTOCOL_SOCKS) {
          socket.write(responseInfoToBuffer(getUpgradeResponse(protocol)));
        }

        logColorful({color: 'red'}, `handle sockeet for ${socksServerConfig.socksVersion}`);
        const info = await handleConnection(socket, socksServerConfig);
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

export async function startHttpServerForSocksV5(config?: Partial<SocksServerConfig<'v5'>>) {
  const socksServerConfig: SocksServerConfig<'v5'> = {
    socksVersion: 'v5',
    methodList: [{method: EMethod.NoAuth}],
    ...(config ?? {}),
  };
  return startHttpServerForSocks(socksServerConfig);
}

export async function startHttpServerForSocksVc1(config?: Partial<SocksServerConfig<'vc1'>>) {
  const socksServerConfig: SocksServerConfig<'vc1'> = {socksVersion: 'vc1', auth: auth, ...(config ?? {})};
  return startHttpServerForSocks(socksServerConfig);
}
