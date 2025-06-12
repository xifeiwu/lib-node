import tls from 'tls';
import {logColorful} from '../../log';

export async function testTlsConnection() {
  
  const client = await new Promise<tls.TLSSocket>((res, rej) => {
    const client = tls.connect({
      host: 'nodejs.org',
      port: 443,
      servername: 'nodejs.org',
    });
    client.on('secureConnect', () => {
      res(client);
    });
    client.on('error', err => {
      rej(err);
    });
    client.on('timeout', () => {
      rej('timeout');
    });
  });
  logColorful({}, client.bytesRead);
}
