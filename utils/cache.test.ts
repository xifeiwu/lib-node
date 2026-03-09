import assert from 'assert';
import {logColorful} from '../log';
import {cacheData} from './cache';

const maxAge = 3000;
const {getOrFetch} = cacheData({maxAge}, async () => {
  await new Promise(res => setTimeout(res, 1000));
  return Date.now();
});

export async function runUseCachedData() {
  const results = await Promise.all(new Array(10).fill(getOrFetch).map(it => it()));
  const v1 = await getOrFetch();
  await new Promise(res => setTimeout(res, maxAge));
  const v2 = await getOrFetch();
  logColorful({}, results, v1, v2);
  assert(results.every(it => it === v1));
  assert.notEqual(v1, v2);
}
