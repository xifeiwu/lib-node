import assert from 'assert';
import {get, set} from './utils';

export function testSet() {
  {
    const obj1: {
      a?: {
        b?: {
          c?: number;
        };
      };
    } = {};
    set(obj1, ['a', 'b', 'c'], 5);
    assert.deepEqual(
      {
        a: {
          b: {
            c: 5,
          },
        },
      },
      obj1
    );
    const value1 = get(obj1, ['a', 'b'], 3);
    assert.deepEqual(value1, {c: 5});
    const value2 = get(obj1, ['a', 'b', 'c', 'd'], 3);
    assert.deepEqual(value2, 3);
  }
  const obj2: {
    a?: {b: number}[];
  } = {};
  set(obj2, ['a', 0, 'b'], 5);
  assert.deepEqual(
    {
      a: [
        {
          b: 5,
        },
      ],
    },
    obj2
  );
}
