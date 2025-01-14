import assert, {deepStrictEqual} from 'assert';
import {
  deepClone,
  deepEqual,
  deepMerge,
  customDeepMerge,
  isPlainObject,
  overrideObj,
  get,
  set,
} from './utils';
import {CompareFilter} from './service';

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
  const cases: {
    description?: string;
    params: any[];
    expected: any;
  }[] = [
    {
      description: `get cusotmized deepMerge with config mergeArraySolution = 'concat'`,
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
  ];

  const deepMerge2 = customDeepMerge({
    mergeArraySolution: 'concat',
  });
  for (const it of cases) {
    const {params, expected} = it;
    const result = deepMerge2(...params);
    assert.deepEqual(expected, result);
  }
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

export function testDeepEequal() {
  const simpleTest = () => {
    const source1 = {a: 1, b: [2, 3], c: 4};
    const source2 = {a: 1, b: [2, 3], c: 4};
    const source3 = {a: 1, b: [2, 5], c: 4};
    assert.ok(deepEqual(source1, source2));
    assert.ok(!deepEqual(source2, source3, {debug: false}));
    assert.ok(deepEqual(source2, source3, {excludeObjectKeys: {b: {1: null}}}));
  };
  const testDeepEqualWithIgnore = () => {
    const payload = {
      queries: [
        {
          type: 'group-by',
          dataset: 'ExperienceInsights',
          metrics: ['AppTotalUserEvents'],
          interval: '2022-12-19T00:00:00+05:30/2022-12-19T23:59:59+05:30',
          groupBy: ['m3.dv.n', 'CITY'],
          // groupBy: ['m3.dv.n', 'CITY1'],
          orderBy: 'desc',
          sortBy: [
            {
              metric: 'AppTotalUserEvents',
              order: 'desc',
            },
          ],
          options: {
            withTotals: true,
          },
        },
      ],
    };
    const payload2 = {
      queries: [
        {
          type: 'group-by',
          dataset: 'ExperienceInsights',
          metrics: ['AppTotalUserEvents'],
          interval: '2022-12-19T00:00:00+05:30/2022-12-19T23:59:59+05:30',
          groupBy: ['GEO', 'CITY'],
          orderBy: 'desc',
          sortBy: [
            {
              metric: 'AppTotalUserEvents',
              order: 'desc',
            },
          ],
          options: {
            withTotals: true,
          },
        },
      ],
    };
    const excludeKeysOfObject: CompareFilter = {
      queries: {0: {interval: null, groupBy: {0: null}}},
    };
    // const
    assert.ok(
      deepEqual(payload, payload2, {
        excludeObjectKeys: excludeKeysOfObject,
        debug: true,
      })
    );
    // test whether ignoreKeysList is effected during the previous compare
    assert.ok(
      deepEqual(payload, payload2, {
        excludeObjectKeys: excludeKeysOfObject,
        debug: true,
      })
    );
    assert.ok(
      deepEqual(payload, payload2, {
        includeObjectKeys: {
          queries: {
            0: {
              type: null,
            },
          },
        },
        debug: true,
      })
    );
  };

  function testUseKeyOfObject() {
    const payload1 = {
      queries: [
        {
          type: 'multi-group-by',
          dataset: 'ExperienceInsights',
          metrics: ['EndedPlays', 'UniqueDevices'],
          interval: '2023-11-06T00:00:00+02:00/2023-11-12T23:59:59+02:00',
          granularity: 'ALL',
          filter: [],
          limit: 200,
          groupBy: ['m3.dv.n'],
          orderBy: 'desc',
          sortBy: [{metric: 'EndedPlays', order: 'desc'}],
          options: {withTotals: true},
          isLiveMode: false,
          metricFilter: [{type: 'bound', dimension: 'LifeVPFPlayingTimeMs', upper: 3000000, lower: 600000}],
        },
      ],
    };
    const payload2 = {
      queries: [
        {
          type: 'multi-group-by',
          dataset: 'ExperienceInsights',
          metrics: ['EndedPlays', 'UniqueDevices'],
          interval: '2023-11-06T00:00:00+02:00/2023-11-12T23:59:59+02:00',
          granularity: 'ALL',
          filter: [],
          limit: 200,
          groupBy: ['m3.dv.n'],
          orderBy: 'desc',
          sortBy: [{metric: 'EndedPlays', order: 'desc'}],
          options: {withTotals: true},
          isLiveMode: false,
          /** different here */
          metricFilter: [{type: 'bound', dimension: 'LifeVPFPlayingTimeMs', upper: 300000, lower: 60000}],
        },
      ],
    };
    assert(
      deepEqual(payload1, payload2, {
        includeObjectKeys: {
          queries: {
            0: {
              type: null,
            },
          },
        },
        debug: true,
      })
    );
  }
  simpleTest();
  testDeepEqualWithIgnore();
  testUseKeyOfObject();
}

export function testKeyStack() {
  const s1 = {
    url: '/v1.0/metrics/user-defined',
    method: 'post',
    query: {mode: 'app'},
  };
  const s2 = {
    method: 'post',
    url: '/v1.0/metrics/user-defined',
    query: {mode: 'app', forceUpdate: 'true'},
  };
  const isEqual = deepEqual(s1, s2, {debug: true, includeObjectKeys: {query: {forceUpdate: null}}});
  assert(!isEqual);
  const isEqual2 = deepEqual(s1, s2, {debug: true, includeObjectKeys: {query: {mode: null}}});
  assert(isEqual2);
}

export function testIgnore() {
  deepEqual(
    {
      queries: [
        {
          type: 'timeseries',
          dataset: 'AppExperience',
          metrics: [
            'AppAvgPageLoadTime',
            'AppAvgScreenLoadTime',
            'AppPageLoads',
            'AppSessions',
            'AppTotalUserEvents',
            'AppUniqueDevices',
            'AverageMinutesPerPage',
            'AverageRequestCount',
            'AverageRequestDuration',
          ],
          interval: '2023-11-22T02:19:00+02:00/2023-11-22T08:19:21+02:00',
          granularity: 'PT1M',
          filter: [],
          options: {withTotals: true},
          isLiveMode: false,
          _rKey: 0,
        },
      ],
    },
    {
      queries: [
        {
          type: 'group-by',
          dataset: 'AppExperience',
          metrics: ['AverageRequestCount', 'AppSessions', 'AppUniqueDevices'],
          interval: '2023-11-22T02:43:00+02:00/2023-11-22T08:43:47+02:00',
          granularity: 'ALL',
          filter: [],
          limit: 200,
          groupBy: ['network_request_response_code'],
          orderBy: 'desc',
          sortBy: [
            {
              metric: 'AverageRequestCount',
              order: 'desc',
            },
          ],
          options: {
            withTotals: true,
          },
          isLiveMode: false,
        },
      ],
    },
    {
      debug: true,
      excludeObjectKeys: {
        queries: {0: {interval: null}},
      },
    }
  );
}
