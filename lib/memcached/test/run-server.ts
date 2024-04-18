import {PORT} from '../../../config';
import {startServer} from '../server';

async function start() {
  const {host, port} = await startServer({
    host: '127.0.0.1',
    port: PORT.tmpMemcached.port,
  });
  console.log(`start socket server on: ${host}:${port}`);
}

start();