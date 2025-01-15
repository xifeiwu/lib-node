import assert, {deepStrictEqual} from 'assert';
import {deepClone, customDeepMerge, isPlainObject, overrideObj, get, set} from './imported';
import {runFuncTestCases} from '../../index';

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

export function testIsPlainObject() {
  console.log(isPlainObject({}));
  class A {}
  console.log(isPlainObject(new A()));
  console.log(isPlainObject([1, 2, 3]));
  console.log(isPlainObject(new Date()));
}

async function runCase(options: {desc?: string; func: () => void}) {
  const {desc, func} = options;
  console.log(`run test case: ${desc}`);
  await func();
}

export function testDeepMergeWithConcatArray() {
  const deepMerge2 = customDeepMerge();
  // for (const it of cases) {
  //   const {params, expected} = it;
  //   const result = deepMerge2(...params);
  //   assert.deepEqual(expected, result);
  // }
  runFuncTestCases(deepMerge2, [
    {
      description: [`get cusotmized deepMerge with config mergeArraySolution = 'concat'`],
      params: [
        {
          path: '/user/:id/:props',
          query: {
            suffix: [2],
          },
        },
        {
          path: '/user/:id',
          query: {
            suffix: [1, true],
          },
        },
      ],
      expected: {
        path: '/user/:id',
        query: {
          suffix: [2, 1, true],
        },
      },
    },
    {
      params: [undefined, {delay: 3, show: true, engine: ['p1', '3']}],
      expected: '',
      dryRun: true,
    },
  ]);
}

export function testOverrideObj() {
  function getObj() {
    return {
      pipeline: {
        list: {
          pageSize: 1,
        },
      },
    };
  }
  // 对象有冗余数据
  deepStrictEqual(
    overrideObj(getObj(), {
      pipeline: {
        list: {
          pageSize: 2,
          pageNum: 5,
        },
        status: {
          show: false,
        },
      },
    }),
    {
      pipeline: {
        list: {
          pageSize: 2,
        },
      },
    }
  );
  // from对象没有对应字段
  deepStrictEqual(
    overrideObj(getObj(), {
      pipeline: {
        status: {
          show: false,
        },
      },
    }),
    {
      pipeline: {
        list: {
          pageSize: 1,
        },
      },
    }
  );
  // 对象为空
  deepStrictEqual(overrideObj(getObj(), {}), {
    pipeline: {
      list: {
        pageSize: 1,
      },
    },
  });
  // 对象为空
  deepStrictEqual(overrideObj(getObj(), undefined as unknown as {[key: string]: any}), {
    pipeline: {
      list: {
        pageSize: 1,
      },
    },
  });
}

export function testDeepClone() {
  const targetServerInfo = {
    address: 'www.baidu.com',
    port: 334,
  };
  const replyServerInfo = deepClone(targetServerInfo);
  assert.deepEqual(replyServerInfo, targetServerInfo);
}
