import {PORT} from '../../../external';
import {startServer} from '../server';

export async function startMemcachedServer() {
  const {host, port} = await startServer({
    host: '127.0.0.1',
    port: PORT.exploreMemcached.port,
  });
  console.log(`start socket server on: ${host}:${port}`);
}
