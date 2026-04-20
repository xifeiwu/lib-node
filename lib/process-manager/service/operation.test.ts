import assert from 'assert';
import {listProcKeyInfo} from './operation';

export async function testListProcKeyInfo() {
  const list = await listProcKeyInfo();
  assert.ok(Array.isArray(list), 'listProcKeyInfo returns an array');
  console.log(list);
}
