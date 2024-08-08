import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {GoThroughDirOptions, getFileInfoTree} from '../fs';
import {filesize} from '../external';

// return file list in the form of <ul><li></li></ul>
export function htmlFileList(dir: string, options?: GoThroughDirOptions) {
  options = {
    maxDepth: 1,
    ...(options ?? {}),
  };
  try {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error('not a directory');
    }
    const {children} = getFileInfoTree(dir, options);
    const liList = children.map(it => {
      const {
        relativePath,
        stat: {size},
      } = it;
      let item = '';
      const content = `${relativePath} [${filesize(size)}]`;
      const statInfo = fs.statSync(path.resolve(dir, relativePath));
      if (statInfo.isDirectory()) {
        item = `<li><a href="${relativePath}/">${content}/</a></li>`;
      } else if (statInfo.isFile()) {
        item = `<li><a href="${relativePath}">${content}</a></li>`;
      } else {
        item = `<li style="color: red"><a href="${relativePath}">${content}</a></li>`;
      }
      return item;
    });
    const ul = ['<ul>', ...liList, '</ul>'].join('\n');
    return ul;
  } catch (err) {
    console.error(`getFileListInFormOfUl fail`);
    return [];
  }
}

export function htmlDirContent(dir: string, options?: GoThroughDirOptions) {
  options = {
    maxDepth: 1,
    ...(options ?? {}),
  };
  const ulStr = htmlFileList(dir, options);
  return `<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="initial-scale=1, width=device-width, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="">
    <title>文件列表</title>
    <script>
    window.addEventListener('load', function() {
    });
    </script>
    <style>
    </style>
  </head>
  <body>
    ${ulStr}
  </body>
</html>`;
}

/**
 * response for a file or dir
 */
export async function getFileContentInFormOfStream(targetFile: string) {
  if (!targetFile) {
    return null;
  }
  if (!fs.existsSync(targetFile)) {
    return null;
  }

  const statInfo = fs.statSync(targetFile);
  if (statInfo.isDirectory()) {
    const body = htmlDirContent(targetFile);
    return new Readable({
      read() {
        this.push(body);
        this.push(null);
      },
    });
  } else if (statInfo.isFile()) {
    return fs.createReadStream(targetFile);
  }
}
