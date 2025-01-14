import {runFuncTestCases} from '../service';
import {customDeepMerge} from './imported';

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
