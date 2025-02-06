import {getFilePathInfo} from './path';
import {runFuncTestCases} from './service';

export function testGetFilePathInfo() {
  runFuncTestCases(
    getFilePathInfo,
    [
      {
        params: ['/zMovie/modules/lib/node'],
        expected: {
          dirname: '/zMovie/modules/lib',
          basename: 'node',
          bareBasename: 'node',
          extname: '',
        },
      },
      {
        description: ['param is dir'],
        params: ['/zMovie/modules/lib/node/'],
        expected: {
          dirname: '/zMovie/modules/lib',
          basename: 'node',
          bareBasename: 'node',
          extname: '',
        },
      },
      {
        description: ['folder can also be basename'],
        params: ['zMovie/modules/lib/node/'],
        expected: {
          dirname: 'zMovie/modules/lib',
          basename: 'node',
          bareBasename: 'node',
          extname: '',
        },
      },
      {
        params: ['zMovie/modules/lib/node/path.test.ts'],
        expected: {
          dirname: 'zMovie/modules/lib/node',
          basename: 'path.test.ts',
          bareBasename: 'path.test',
          extname: '.ts',
        },
      },
      {
        description: ['file path without dirname'],
        params: ['bar.ts'],
        expected: {
          dirname: '.',
          basename: 'bar.ts',
          extname: '.ts',
          bareBasename: 'bar',
        },
      },
      {
        description: ['file path with dirname: ./'],
        params: ['./bar.ts'],
        expected: {
          dirname: '.',
          basename: 'bar.ts',
          extname: '.ts',
          bareBasename: 'bar',
        },
      },
    ],
    false
  );
}
