import {logColorful} from '../../../../log';
import {connectToSocksServer} from '../../client';
import {serializableSocksClientInfo} from '../../service';
import {startHttpDebugServer} from '../../service/external';
import {
  auth,
  getSocksClientConfigV5,
  getSocksServerConfigV5,
  getSocksServerConfigVc1,
  startHttpServerForSocksVc1,
  startSocketServerForSocks,
  startSocketServerForSocksV5,
} from '../service';

/**
 * used to catch error, such as:
 * node Error: read ECONNRESET
 */
process.on('uncaughtException', function (err) {
  console.log('uncaughtException:');
  console.log(err.stack);
});

async function startSocksServerOnTcp() {
  const serverVc1 = await startSocketServerForSocks(getSocksServerConfigVc1());
  const serverV5 = await startSocketServerForSocks(
    getSocksServerConfigV5({
      proxyConfigList: [
        {
          socksVersion: 'vc1',
          socksServer: {
            host: serverVc1.host,
            port: serverVc1.port,
          },
          auth,
          matches: ['elif.site', 'baidu.com'],
        },
      ],
    })
  );
  return {serverVc1, serverV5};
}
async function startSocksServerOnHttp() {
  const serverVc1 = await startHttpServerForSocksVc1();
  const serverV5 = await startSocketServerForSocksV5({
    proxyConfigList: [
      {
        socksVersion: 'vc1',
        socksServer: serverVc1.origin,
        auth,
        matches: ['elif.site', 'baidu.com'],
      },
    ],
  });
  return {serverVc1, serverV5};
}
export async function proxy() {
  const {serverVc1, serverV5} = await startSocksServerOnTcp();
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
