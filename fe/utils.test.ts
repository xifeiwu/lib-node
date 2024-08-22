import assert from 'assert';
import {runFuncTestCases} from '../test';
import {set} from './utils';

export function testSet() {
  const obj: {
    a?: {
      b?: {
        c?: number;
      };
    };
  } = {};
  set(obj, ['a', 'b', 'c'], 5);
  assert.deepEqual(
    {
      a: {
        b: {
          c: 5,
        },
      },
    },
    obj
  );
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
