import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {flatChildren, getFileInfoTree, getFileList, getLineCountMap} from './read';
import {isString} from '../external';
import {runFuncTestCases} from '../service';
import {FileInfoTreeItem} from '../types';
import { logColorful } from '../log';

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

export function testFilteroutHiddenFiles() {
  const filterOutHiddenFile = (info) => {
    console.log(info);
    const {basename} = info;
    return basename.startsWith('.')
  };
  const fullPath = '/Users/wuxifei/code/react/start/small-apps-wrapper/apps/browser-feature';
  const files = getFileList(fullPath, {
    fileFilter(info) {
      return filterOutHiddenFile(info);
    },
    dirFilter(info) {
      return filterOutHiddenFile(info);
    },
  });
  logColorful({}, files);
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
  runFuncTestCases(getFileInfoTree, [
    {
      params: [
        __dirname,
        {
          fileFilter({basename}) {
            return basename.startsWith('fs');
          },
        },
      ],
      expected(fileInfoTree) {
        const {children, relativePath} = fileInfoTree;
        assert.equal(relativePath, '');
        assert.equal(children.length, 2);
        return true;
      },
    },
  ]);
}

export function readPermission() {
  const fileInfoTree = getFileInfoTree(process.env.HOME, {
    maxDepth: 1,
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
    const {relativePath, stats: stat, children} = it;
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
