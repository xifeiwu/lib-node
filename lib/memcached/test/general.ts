import assert from 'assert';
import {PORT} from '../../../config';
import {getClient} from '../client';
import {startServer} from '../server';
import { startMemcachedServer } from './utils';

const testKeyPair = {
  key: 'abc',
  value: 'dd',
};
async function saveValue() {
  // const {host, port} = await startServer({
  //   host: '127.0.0.1',
  //   port: PORT.tmpMemcached.port,
  // });
  // console.log(`start socket server on: ${host}:${port}`);
  const client = getClient({host: '127.0.0.1', port: PORT.tmpMemcached.port});
  const setRes = await client.set({
    expireTimeInSeconds: 500000,
    flags: 'd',
    ...testKeyPair,
  });
  console.log(setRes);
  // const getRes = await client.gets(['abc']);
  // console.log(getRes);
}

export async function getValue() {
  // await saveValue();
  const client = getClient({host: '127.0.0.1', port: PORT.tmpMemcached.port});
  const valueByGets = await client.gets(['abc']);
  assert.deepEqual(valueByGets, {[testKeyPair.key]: testKeyPair.value});
  const valueByGet = await client.get('abc');
  assert.equal(valueByGet, testKeyPair['value']);
}

export async function testDelete() {
  await startMemcachedServer();
  await saveValue();
  const client = getClient({host: '127.0.0.1', port: PORT.tmpMemcached.port});
  const valueByGet = await client.get('abc');
  assert.equal(valueByGet, testKeyPair['value']);
  const valueByGet1 = await client.delete('abc');
  console.log(valueByGet1);
}
