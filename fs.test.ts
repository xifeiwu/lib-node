import assert from 'assert';
import {FileInfoTreeItem, getFileInfoTree, getFileList} from './fs';
import {isString} from './fe';

export function testGetFileList() {
  const fileList = getFileList(__dirname, {
    fileFilter({baseName}) {
      return baseName.startsWith('fs');
    },
  });
  assert.ok(Array.isArray(fileList));
  assert.equal(fileList.length, 2);
  assert.ok(isString(fileList[0]));
}

export function testGetFileInfoTree() {
  const fileInfoTree = getFileInfoTree(__dirname, {
    fileFilter({baseName}) {
      return baseName.startsWith('fs');
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
