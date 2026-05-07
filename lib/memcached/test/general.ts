import assert from 'assert';
import {getClient} from '../client';
import {startServer} from '../server';
import {startMemcachedServer} from './utils';
import {PORT} from '../../../external';

const testKeyPair = {
  key: 'abc',
  value: 'dd',
};

export async function saveValue() {
  // const port = PORT.exploreMemcached.port;
  const port = PORT.fullFeatureTcpServer.port;
  const client = getClient({host: '127.0.0.1', port});
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
  await startMemcachedServer();
  await saveValue();
  const client = getClient({host: '127.0.0.1', port: PORT.exploreMemcached.port});
  const valueByGets = await client.gets(['abc']);
  assert.deepEqual(valueByGets, {[testKeyPair.key]: testKeyPair.value});
  const valueByGet = await client.get('abc');
  assert.equal(valueByGet, testKeyPair['value']);
}

export async function testDelete() {
  // await startMemcachedServer();
  await saveValue();
  const client = getClient({host: '127.0.0.1', port: PORT.exploreMemcached.port});
  const valueByGet = await client.get('abc');
  assert.equal(valueByGet, testKeyPair['value']);
  const valueByGet1 = await client.delete('abc');
  console.log(valueByGet1);
}
