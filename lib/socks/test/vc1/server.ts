import {handleSocksConnection} from '../../server';
import {SOCKS_AUTH_USER_PASS} from '../../service';
import {logColorful, startSocketServer} from '../../service/external';
export async function runStartSocketServer() {
  const {overTls, host, port, path, server} = await startSocketServer(
    socket => {
      handleSocksConnection(socket, {
        auth: SOCKS_AUTH_USER_PASS,
        socksVersion: 1,
      });
    },
    {
      port: 3160,
    }
  );
  logColorful({}, {overTls, host, port});
}
