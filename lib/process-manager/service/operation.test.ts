import assert from 'assert';
import {getAllProcKeyInfo} from './operation';

export async function testGetAllProcKeyInfo() {
  const list = await getAllProcKeyInfo();
  assert.ok(Array.isArray(list), 'getAllProcKeyInfo returns an array');
  console.log(list);
}
