import {logColorful} from '../../../../log';
import {connectToSocksServer} from '../../client';
import {serializableSocksClientInfo} from '../..';
import {startHttpDebugServer} from '../../service/external';
import {
  auth,
  getSocksClientConfigV5,
  getSocksServerConfigV5,
  getSocksServerConfigVc1,
  startTcpServerForSocks,
  startHttpServerForSocks,
} from '../service';

/**
 * used to catch error, such as:
 * node Error: read ECONNRESET
 */
process.on('uncaughtException', function (err) {
  console.log('uncaughtException:');
  console.log(err.stack);
});

async function runSocksOverHttp() {
  /** only vc1 can be handle by http upgrade */
  return await startHttpServerForSocks({
    1: getSocksServerConfigVc1(),
  });
}
async function startTwoSocksServer() {
  const serverOverHttp = await runSocksOverHttp();
  const serverOverTcp = await startTcpServerForSocks({
    5: getSocksServerConfigV5({
      proxyConfigList: [
        {
          socksVersion: 1,
          socksServer: serverOverHttp.origin,
          auth,
          matches: ['elif.site', 'baidu.com'],
        },
      ],
    }),
    1: getSocksServerConfigVc1(),
  });
  return {serverOverTcp, serverOverHttp};
}

export async function proxy() {
  const {serverOverHttp: serverVc1, serverOverTcp: serverV5} = await startTwoSocksServer();
  // const {serverVc1, serverV5} = await startSocksServerOnHttp();
  logColorful({}, 'socks server vc1:', {host: serverVc1.host, port: serverVc1.port});
  logColorful({}, 'socks server v5:', {host: serverV5.host, port: serverV5.port});
  const {origin: httpOrigin} = await startHttpDebugServer();
  const status1 = await connectToSocksServer(
    getSocksClientConfigV5({host: serverV5.host, port: serverV5.port}, httpOrigin)
  );
  logColorful({}, serializableSocksClientInfo(status1));
  const status2 = await connectToSocksServer(
    getSocksClientConfigV5({host: serverV5.host, port: serverV5.port}, 'http://elif.site')
  );
  logColorful({}, serializableSocksClientInfo(status2));
}
