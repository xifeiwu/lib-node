import fs from 'fs';
import path from 'path';
import stream from 'stream';
import db from 'mime-db';

// return file list in the form of <ul><li></li></ul>
export function getFileListInFormOfUl(dir: string, filter?: () => boolean) {
  filter = filter ? filter : () => true;
  try {
    var stat = fs.statSync(dir);
    if (!stat.isDirectory()) {
      throw new Error('not a directory');
    }
    const fileList = fs.readdirSync(dir);
    const liList = Array.prototype.slice
      .call(fileList)
      .filter(filter)
      .map(it => {
        var item = '';
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

export function getDirContentInFormOfHtml(dir: string, filter?: () => boolean) {
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
    return new stream.Readable({
      read() {
        this.push(body);
        this.push(null);
      },
    });
  } else if (statInfo.isFile()) {
    return fs.createReadStream(targetFile);
  }
}

// export function defaultResponse(response: http.ServerResponse) {
//   response.writeHead(200, {
//     'Content-Type': 'html'
//   });
//   fs.createReadStream(path.resolve(__dirname, 'net.html')).pipe(response);
// }
// export function startBasicServer(cb) {
//   let HTTPPORT = 0;
//   let server = http.createServer((request, response) => {
//     // this.showRequest(request);
//     if (typeof(cb) !== 'function') {
//       defaultResponse(response);
//     } else {
//       cb(request, response);
//     }
//   });
//   server.listen(HTTPPORT);
//   server.on('listening', () => {
//     let port = server.address().port;
//     let localIP = this.getLocalIP();
//     console.log(`start at: http://${localIP}:${port}`);
//   })
// }

// getParsedUrl(request) {
//   // const
//   var urlString = 'http://' + request.headers['host'] + request.url;
//   var obj = url.parse(urlString);
//   if (obj.query) {
//     obj.query = this.parseQueryString(obj.query);
//   }
//   return obj;
// }

// /**
//  * @param {ctx}, ctx of koa
//  * @param {next}, ctx of next
//  * @param {prefix}, filter url started with prefix
//  * @param {refDir}, the start dir from which to search target file
//  */
// export async function koaMiddlewareResponseStatic(ctx, next, prefix, refDir = __dirname) {
//   const url = ctx.url;

//   if (url.startsWith(prefix)) {
//     return await next();
//   }
//   const targetFile = this.findClosestFile(refDir, url.replace('/', ''));
//   if (!targetFile) {
//     return await next();
//   }
//   const statInfo = fs.statSync(targetFile);
//   if (statInfo.isDirectory() && !url.endsWith('/')) {
//     ctx.redirect(`${url}/`);
//     return;
//   }
//   const resStream = await this.getFileStream4Response(targetFile);
//   if (resStream) {
//     if (statInfo.isDirectory()) {
//       ctx.type = 'html';
//     } else if (statInfo.isFile()) {
//       ctx.type = targetFile.split('.').pop();
//     }
//     ctx.body = resStream;
//   } else {
//     return await next();
//   }
// }
