import assert from 'assert';
import {getFilePathInfo} from './path';
import {TestCase} from './types/test';
import { logColorful } from './log';

export function testGetFilePathInfo() {
  const allCases: TestCase<string, ReturnType<typeof getFilePathInfo>>[] = [
    {
      data: '/zMovie/modules/lib/node',
      expected: {
        dirname: '/zMovie/modules/lib',
        extname: '',
        basename: 'node',
        bareBasename: 'node',
      },
    },
    {
      data: 'zMovie/modules/lib/node',
      expected: {
        dirname: 'zMovie/modules/lib',
        extname: '',
        basename: 'node',
        bareBasename: 'node',
      },
    },
    {
      data: 'zMovie/modules/lib/node/path.test.ts',
      expected: {
        dirname: 'zMovie/modules/lib/node',
        extname: '.ts',
        basename: 'path.test.ts',
        bareBasename: 'path.test',
      },
    },
  ];
  for (const oneCase of allCases) {
    const {data, expected, description} = oneCase;
    description && logColorful({}, ...description);
    assert.deepEqual(getFilePathInfo(data), expected);
  }
}
