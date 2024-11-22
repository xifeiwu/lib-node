import {
  startHttpServer,
  startTcpProxyServer,
  startSocketClient,
  tcpRequestPropsToBuffer,
  toBuffer,
  toUrlProps,
  toUl,
  toHtml,
  getOneLineFromReader,
  responseHttpConnection,
  getUpgradeProtocol,
  getUpgradeResponse,
  responseInfoToBuffer,
  logColorful,
} from '../service/external';
import {basicAuth} from '../service';
import {handleSocksConnection} from '../server';
import {
  SocksServerConfigPerVersion,
  SocksClientConfig,
  SocksServerConfig,
  SocksServerInfo,
  TargetSocksServer,
} from '../types';
import {EMethod, NegotiationInfoClient as NegotiationInfoClientV5} from '../types/v5';
import {RequestTarget} from '../types/base';
import {Socket} from 'net';
import {simplifySocksServerInfo, UPGRADE_PROTOCOL_SOCKS_PREFIX} from '..';
import {htmlUlItems} from '../../..';

export function getSocksClientConfigV5(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<5> = {
    socksVersion: 5,
    methodList: [{method: EMethod.NoAuth}, {method: EMethod.UserPass, info: basicAuth}],
    socksServer,
    requestTarget,
  };
  return info;
}

export function getSocksClientConfigVc1(socksServer: TargetSocksServer, requestTarget: RequestTarget) {
  const info: SocksClientConfig<1> = {
    socksVersion: 1,
    auth: basicAuth,
    socksServer,
    requestTarget,
  };
  return info;
}

export const httpRequestBuffer = tcpRequestPropsToBuffer({
  method: 'post',
  url: '/api/debug/echo',
  data: {a: 1},
});

export function getSocksServerConfigV5(config?: Partial<SocksServerConfig<5>>) {
  const socksServerConfig: SocksServerConfig<5> = {
    socksVersion: 5,
    methodList: [{method: EMethod.NoAuth}],
    ...(config ?? {}),
  };
  return socksServerConfig;
}

export function getSocksServerConfigVc1(config?: Partial<SocksServerConfig<1>>) {
  const socksServerConfig: SocksServerConfig<1> = {socksVersion: 1, auth: basicAuth, ...(config ?? {})};
  return socksServerConfig;
}

export async function startTcpServerForSocks(socksServerConfig: Partial<SocksServerConfigPerVersion>) {
  const infoList: SocksServerInfo[] = [];
  const httpServerInfo = await startHttpServer(
    {
      request(req, res) {
        res.setHeader('content-type', 'application/json');
        const {pathname} = toUrlProps(req.url);
        if (pathname === '/api/list') {
          const data = toBuffer([infoList.map(simplifySocksServerInfo)]);
          res.end(data);
        } else if (pathname === '/api/clear') {
          const {length} = infoList;
          infoList.length = 0;
          res.end(toBuffer({length}));
        } else {
          const data = toBuffer(
            htmlUlItems({
              items: [
                {href: '/api/list', label: '/api/list'},
                {href: '/api/clear', label: '/api/clear'},
              ],
            })
          );
          res.setHeader('content-type', 'text/html');
          res.end(data);
        }
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
    logColorful({color: 'red'}, `handle socket for ${socksConfig.socksVersion}`);
    const info = await handleSocksConnection(socket, socksConfig);
    if (infoList.length > 200) {
      infoList.pop();
    }
    infoList.unshift(info);
  };
  const tcpHandler = async (socket: Socket, info) => {
    return handleAsSocks(socket, info.firstChunk);
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

export async function startHttpServerForSocks(allSocksServerConfig: Partial<SocksServerConfigPerVersion>) {
  const infoList: SocksServerInfo[] = [];
  function abortRequest(socket: Socket, protocol: string) {
    responseHttpConnection(socket, {
      code: 400,
      message: `can not handle protocol: ${protocol}`,
    });
  }
  const httpServerInfo = await startHttpServer(
    {
      request(req, res) {
        res.setHeader('content-type', 'application/json');
        const data = toBuffer([infoList.map(simplifySocksServerInfo)]);
        res.end(data);
      },
      async upgrade(req, socket) {
        const protocol = getUpgradeProtocol(req);
        if (!protocol.startsWith(UPGRADE_PROTOCOL_SOCKS_PREFIX)) {
          return abortRequest(socket, protocol);
        }
        let socksServerConfig: SocksServerConfig;
        /** Get version from protocol string first */
        const version = protocol.replace(UPGRADE_PROTOCOL_SOCKS_PREFIX, '');
        if (version.length > 0) {
          socksServerConfig = allSocksServerConfig[version];
          if (!socksServerConfig) {
            return abortRequest(socket, protocol);
          }
        }
        socket.write(responseInfoToBuffer(getUpgradeResponse(protocol)));
        if (!socksServerConfig) {
          const bufferOfFirstLine = await getOneLineFromReader(socket, {firstChunkOnly: true});
          const firstByte = bufferOfFirstLine[0];
          socksServerConfig = allSocksServerConfig[firstByte];
          if (socksServerConfig) {
            socket.unshift(bufferOfFirstLine);
          } else {
            return abortRequest(socket, protocol);
          }
        }
        logColorful({color: 'red'}, `handle socket for ${socksServerConfig.socksVersion}`);
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
