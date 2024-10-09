import assert from 'assert';
import {toBuffer, convertToBuffer} from './buffer';
import {logColorful} from '../log';
import {CanConvertToBuffer} from '../types';

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
export async function testConvertToBuffer() {
  console.log(toBuffer(1));
  const cases: {
    params: Array<CanConvertToBuffer | Array<CanConvertToBuffer>>;
    expected: string | number[];
    description?: string;
  }[] = [
    {
      params: [1, 2, 3],
      expected: [1, 2, 3],
      description: 'type of array items are all number',
    },
    {
      params: [[1, '2', 3]],
      expected: `[1,"2",3]`,
      description: 'array as an item',
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
    const buf = convertToBuffer(...params);
    if (Array.isArray(expected)) {
      assert.deepEqual([...buf], expected);
    } else {
      assert.equal(buf.toString(), expected);
    }
  }
}

export async function bufferConvert() {
  const command = 1;
  const addressType = 1;
  const address = '127.0.0.1';
  const port = 3005;
  const buffer = toBuffer([5, command, 0, addressType, address, port]);
  console.log(buffer);
}
