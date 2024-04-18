import {PORT} from '../../../config';
import {getClient} from '../client';
import {startServer} from '../server';

export async function testFlow() {
  // const {host, port} = await startServer({
  //   host: '127.0.0.1',
  //   port: PORT.tmpMemcached.port,
  // });
  // console.log(`start socket server on: ${host}:${port}`);
  const client = getClient({host: '127.0.0.1', port: PORT.tmpMemcached.port});
  const setRes = await client.set({
    key: 'abc',
    value: 'dd',
    expireTimeInSeconds: 500000,
    flags: 'd',
  });
  console.log(setRes);
  const getRes = await client.get(['abc']);
  console.log(getRes);
}

export async function getValue() {
  const client = getClient({host: '127.0.0.1', port: PORT.tmpMemcached.port});
  const getRes = await client.get(['abc']);
  console.log(getRes);
}
