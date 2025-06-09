import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {getDtFromPath, getFilePathInfo, getPathWithDtSuffix, makeSureDirExist} from './path';
import {runFuncTestCases} from './service';

export function testGetFilePathInfo() {
  runFuncTestCases(getFilePathInfo, [
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
  ]);
}

export async function dateTimeSuffix() {
  const filePath = path.join(__dirname, 'tmp.ts');
  fs.writeFileSync(filePath, 'aa');
  assert(fs.existsSync(filePath));
  const pathWithSuffix = getPathWithDtSuffix(filePath);
  fs.renameSync(filePath, pathWithSuffix);
  const dt = getDtFromPath(pathWithSuffix);
  assert(dt instanceof Date);
  fs.unlinkSync(pathWithSuffix);
}

export async function testMakeSureDirExist() {
  const relativePath = 'a/b/c';
  fs.existsSync(relativePath) && fs.rmdirSync(path.resolve(process.cwd(), relativePath), {recursive: true});
  await runFuncTestCases(makeSureDirExist, [
    {
      params: [relativePath],
      expected(res: string) {
        assert.equal(res, relativePath);
        return fs.existsSync(path.join(process.cwd(), relativePath));
      },
    },
  ]);
  fs.existsSync(relativePath) && fs.rmdirSync(path.resolve(process.cwd(), relativePath), {recursive: true});
}
