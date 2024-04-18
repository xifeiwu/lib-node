import {getClient} from '../client';
import {startServer} from '../server';

export async function testFlow() {
  const {host, port} = await startServer();
  const client = getClient({host, port});
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
