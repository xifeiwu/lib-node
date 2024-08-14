import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  FileInfoTreeItem,
  flatChildren,
  getFileInfoTree,
  getFileList,
  getLineCountMap,
  makeSureDirExist,
  recursiveDeleteFile,
} from './fs';
import {isString} from './external';
import {runFuncTestCases} from './test';
import {FuncTestCase} from './types';

export function testGetFileList() {
  const fileList = getFileList(__dirname, {
    fileFilter({basename}) {
      return basename.startsWith('fs');
    },
  });
  assert.ok(Array.isArray(fileList));
  assert.equal(fileList.length, 2);
  assert.ok(isString(fileList[0]));
}

/**
 * Just used to check data, can modify anytime.
 */
export function testGetFileListByDir() {
  const targetDir = path.resolve(__dirname, 'net');
  const relativeFileList = getFileList(targetDir, {
    fileFilter({relativePath}) {
      return relativePath.endsWith('test.ts');
    },
  });
  console.log(relativeFileList);
}

export function filePathForGetLineCountMap() {
  const lineCountMap = getLineCountMap(path.join(__dirname, 'fs.ts'));
  console.log(lineCountMap);
}
export function testGetLineCountMap() {
  const lineCountMap = getLineCountMap(__dirname);
  console.log(lineCountMap);
  const lineCountList = flatChildren(lineCountMap, {
    sortChildren(prev, next) {
      return next.lineCount - prev.lineCount;
    },
  });
  console.log(lineCountList);
}

// export function testGetLineCount() {
//   const fileList = getLineCountList(__dirname);
//   console.log(fileList);
//   // assert.ok(Array.isArray(fileList));
//   // assert.equal(fileList.length, 2);
//   // assert.ok(isString(fileList[0]));
// }

export function testGetFileInfoTree() {
  const fileInfoTree = getFileInfoTree(__dirname, {
    fileFilter({basename}) {
      return basename.startsWith('fs');
    },
  });
  const {children, relativePath} = fileInfoTree;
  assert.equal(relativePath, '');
  assert.equal(children.length, 2);
}

interface FileSize {
  relativePath: string;
  size: number;
  children?: FileSize[];
}
export function testGetFileSizeTree() {
  const fileInfoTree = getFileInfoTree(__dirname);
  function getFileSize(it: FileInfoTreeItem): FileSize {
    const {relativePath, stat, children} = it;
    if (stat.isDirectory()) {
      /** sort child by size */
      const childrenInfo = children.map(getFileSize).sort((prev, next) => {
        return next.size - prev.size;
      });
      const totalSize = childrenInfo.reduce<number>((sum, it) => {
        return sum + it.size;
      }, 0);
      return {
        relativePath,
        children: childrenInfo,
        size: totalSize,
      };
    } else {
      return {relativePath, size: stat.size};
    }
  }
  const fileSizeInfo = getFileSize(fileInfoTree);
  console.log(fileSizeInfo);
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
