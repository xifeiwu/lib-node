import assert from 'assert';
import {toBuffer} from './transform';

export async function testToBuffer() {
  console.log(await toBuffer(1));
  assert.deepEqual([...(await toBuffer(1))], [1]);
  assert.deepEqual([...(await toBuffer('a'))], [97]);
  assert.deepEqual([...(await toBuffer([1, 'a']))], [1, 97]);
}
