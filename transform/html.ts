import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';

// return file list in the form of <ul><li></li></ul>
export function getFileListInFormOfUl(dir: string, filter?: (fileName: string) => boolean) {
  filter = filter ? filter : () => true;
  try {
    const stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error('not a directory');
    }
    const fileList = fs.readdirSync(dir);
    const liList = Array.prototype.slice
      .call(fileList)
      .filter(filter)
      .map(it => {
        let item = '';
        const statInfo = fs.statSync(path.resolve(dir, it));
        if (statInfo.isDirectory()) {
          item = `<li><a href="${it}/">${it}/</a></li>`;
        } else if (statInfo.isFile()) {
          item = `<li><a href="${it}">${it}</a></li>`;
        } else {
          item = `<li style="color: red"><a href="${it}">${it}</a></li>`;
        }
        return item;
      });
    const ul = ['<ul>', ...liList, '</ul>'].join('');
    return ul;
  } catch (err) {
    console.error(`getFileListInFormOfUl fail`);
    return [];
  }
}

export function getDirContentInFormOfHtml(dir: string, filter?: (fileName: string) => boolean) {
  const ulStr = getFileListInFormOfUl(dir, filter);
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
    const body = getDirContentInFormOfHtml(targetFile);
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
