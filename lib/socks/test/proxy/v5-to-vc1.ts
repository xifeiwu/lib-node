import {logColorful} from '../../../../log';
import {connectToSocksServer} from '../../client';
import {serializableSocksClientInfo} from '../../service';
import {startHttpDebugServer} from '../../service/external';
import {auth, getSocksClientConfigV5, startSocksServerV5, startSocksServerVc1} from '../service';

export async function proxy() {
  const serverVc1 = await startSocksServerVc1();
  const serverV5 = await startSocksServerV5({
    proxyConfigList: [
      {
        socksVersion: 'vc1',
        socksServer: {
          host: serverVc1.host,
          port: serverVc1.port,
        },
        auth,
        matches: ['elif.site'],
      },
    ],
  });
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
