import {getFilePathInfo} from './path';
import {runFuncTestCases} from './test';

export function testGetFilePathInfo() {
  runFuncTestCases(getFilePathInfo, [
    {
      params: ['/zMovie/modules/lib/node'],
      expected: {
        dirname: '/zMovie/modules/lib',
        extname: '',
        basename: 'node',
        bareBasename: 'node',
      },
    },
    {
      description: ['folder can also be basename'],
      params: ['zMovie/modules/lib/node/'],
      expected: {
        dirname: 'zMovie/modules/lib',
        extname: '',
        basename: 'node',
        bareBasename: 'node',
      },
    },
    {
      params: ['zMovie/modules/lib/node/path.test.ts'],
      expected: {
        dirname: 'zMovie/modules/lib/node',
        extname: '.ts',
        basename: 'path.test.ts',
        bareBasename: 'path.test',
      },
    },
  ], true);
}
