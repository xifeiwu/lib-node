import assert from 'assert';
import {runFuncTestCases, CompareFilter} from '../service';
import {customDeepMerge, deepEqual} from './imported';

export function testDefaultDeepMerge() {
  const deepMerge2 = customDeepMerge();
  runFuncTestCases(deepMerge2, [
    {
      description: [`test array merge: two array`],
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
      description: [`test array merge: one primitive, one array`],
      params: [
        {
          path: '/user/:id/:props',
          query: {
            suffix: 2,
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
    // {
    //   params: [undefined, {delay: 3, show: true, engine: ['p1', '3']}],
    //   expected: '',
    //   dryRun: true,
    // },
  ]);
}

export function testDeepEqual() {
  runFuncTestCases(
    deepEqual,
    [
      {
        description: ['empty object should be equal'],
        params: [{}, {}],
        expected: true,
      },
      {
        description: ['empty object should not be equal to undefined'],
        params: [{}, undefined],
        expected: false,
      },
      {
        description: ['empty array should be equal'],
        params: [[], []],
        expected: true,
      },
      {
        description: ['standard case'],
        params: [
          {a: 1, b: [2, 3], c: 4},
          {a: 1, b: [2, 3], c: 4},
        ],
        expected: true,
      },
      {
        description: ['excludeObjectKeys should work'],
        params: [{a: 1, b: [2, 3], c: 4}, {a: 1, b: [2, 5], c: 4}, {excludeObjectKeys: {b: {1: null}}}],
        expected: true,
      },
      {
        description: ['includeObjectKeys should work, only compare {queries: {0: {metricFilter: null}}}'],
        params: [
          {
            queries: [
              {
                type: 'multi-group-by',
                metrics: ['EndedPlays', 'UniqueDevices'],
                metricFilter: [
                  {type: 'bound', dimension: 'LifeVPFPlayingTimeMs', upper: 3000000, lower: 600000},
                ],
              },
            ],
          },
          {
            queries: [
              {
                type: 'group-by',
                metrics: ['UniqueDevices'],
                metricFilter: [
                  {type: 'bound', dimension: 'LifeVPFPlayingTimeMs', upper: 3000000, lower: 600000},
                ],
              },
            ],
          },
          {includeObjectKeys: {queries: {0: {metricFilter: null}}}},
        ],
        expected: true,
      },
    ],
    {
      ignore: false,
    }
  );
}

/**
 *  excludeObjectKeys will not change during logic of deepEqual
 */
export function useIgnoreKeysListTwice() {
  const payload = {
    queries: [
      {
        type: 'group-by',
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
  assert(
    deepEqual(payload, payload2, {
      excludeObjectKeys: excludeKeysOfObject,
      debug: true,
    })
  );
  assert(
    deepEqual(payload, payload2, {
      excludeObjectKeys: excludeKeysOfObject,
      debug: true,
    })
  );
}

export function testDeepEqualKeyStack() {
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
