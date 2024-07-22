import assert from 'assert';
import {toBuffer} from './buffer';
import {logColorful} from '../log';

export async function testToBuffer() {
  console.log(toBuffer(1));
  const cases: {
    params: Parameters<typeof toBuffer>[0];
    expected: number[];
    description?: string;
  }[] = [
    {
      params: [1, 2, 3],
      expected: [1, 2, 3],
      description: 'type of array items are all number',
    },
    {
      params: ['a'],
      expected: [97],
    },
    {
      params: [1, 'a'],
      description: 'number, string together',
      expected: [1, 97],
    },
  ];
  for (const {description, params, expected} of cases) {
    description && logColorful({color: 'yellow'}, description);
    const buf = toBuffer(params);
    assert.deepEqual([...buf], expected);
  }
}
