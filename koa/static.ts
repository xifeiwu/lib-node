// var crypto = require('crypto');
// var fs = require('mz/fs')
// var zlib = require('mz/zlib');
// var path = require('path')
// var mime = require('mime-types')
// var compressible = require('compressible');
// var readDir = require('fs-readdir-recursive');
// var debug = require('debug')('koa-static-cache');

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as zlib from 'zlib';
import * as mimeTypes from 'mime-types';
import {readDirRecursive} from '../path';
import * as Koa from 'koa';
import {toStream} from '../stream';
import {compressible} from '../http';
import stream = require('stream');

interface IOptions {
  dir: string;
  urlPrefix?: string;
  preLoad?: boolean;
  dynamic?: boolean;
  dirFilter?: () => boolean;
  fileFilter?: () => boolean;
  store?: IFileStore;
  enableGzip?: boolean;
  alias?: {
    [pathname: string]: string;
  };
}

interface IHttpHeaderConfig {
  maxAge?: number;
  cacheControl?: string;
}

export interface IFileInfo extends IHttpHeaderConfig {
  fullPath?: string;
  extName?: string;
  contentType?: string;
  size: number;
  modifyTime: Date;
  buffer?: Buffer;
  md5?: string;
}

interface IFileInfoMap {
  [pathname: string]: IFileInfo;
}

export interface IFileStore {
  map: IFileInfoMap;
  get(pathname: string): IFileInfo;
  set(pathname: string, info: IFileInfo): void;
}

export default function staticCache(options: IOptions) {
  let {
    dir = process.cwd(),
    urlPrefix = '/',
    store,
    enableGzip = true,
    dirFilter,
    fileFilter,
    preLoad = true,
    dynamic = true,
    alias = {},
  } = options;
  dir = path.normalize(dir);
  urlPrefix = `/${urlPrefix
    .split('/')
    .filter(it => it)
    .join('/')}`;

  // options = options || {};
  // prefix must be ASCII code
  // options.prefix = (options.prefix || '')
  const files = store ? store : new FileManager();
  // dir = dir || options.dir || process.cwd();
  // var enableGzip = !!options.gzip;
  // var filePrefix = path.normalize(options.urlPrefix.replace(/^\//, ''));

  // option.filter
  // var fileFilter = function () {
  //   return true;
  // };
  // if (Array.isArray(options.filter))
  //   fileFilter = function (file) {
  //     return ~options.filter.indexOf(file);
  //   };
  // if (typeof options.filter === 'function') fileFilter = options.filter;

  // if (options.preload !== false) {
  //   readDir(dir)
  //     .filter(fileFilter)
  //     .forEach(function (name) {
  //       loadFile(name, dir, options, files);
  //     });
  // }
  if (!fs.existsSync(dir)) {
    throw new Error(`dir ${dir} not exist!`);
  }

  if (preLoad) {
    readDirRecursive(dir, {
      dir: dirFilter,
      file: fileFilter,
    }).forEach(relativePath => {
      const fileInfo = getFileInfo(relativePath);
      if (fileInfo) {
        files.set(path.join(urlPrefix, relativePath), fileInfo);
      }
    });
  }

  return async (ctx: Koa.Context, next: Koa.Next) => {
    // only accept HEAD and GET
    if (ctx.method !== 'HEAD' && ctx.method !== 'GET') return await next();

    // decode for `/%E4%B8%AD%E6%96%87`
    // normalize for `//index`
    let pathname = path.normalize(safeDecodeURIComponent(ctx.path));
    // check alias
    if (alias && alias[pathname]) pathname = alias[pathname];
    // check prefix first to avoid calculate
    if (pathname.indexOf(urlPrefix) !== 0) return await next();

    let file = files.get(pathname);
    // console.log(`pathname`);
    // console.log(pathname);
    // console.log(file);
    // try to load file
    if (!file) {
      if (!dynamic) return await next();
      // if (path.basename(pathname)[0] === '.') return await next();
      // if (pathname.charAt(0) === path.sep) pathname = pathname.slice(1);

      // trim prefix
      // if (urlPrefix !== '/') {
      //   if (pathname.indexOf(filePrefix) !== 0) return await next();
      //   pathname = pathname.slice(filePrefix.length);
      // }
      const relativePath = pathname.replace(urlPrefix, '');

      var fullpath = path.join(dir, relativePath);
      // files that can be accessd should be under options.dir
      if (fullpath.indexOf(dir) !== 0) {
        return await next();
      }
      if (!fs.existsSync(fullpath)) {
        return await next();
      }

      const stat = fs.statSync(fullpath);
      // var s;
      // try {
      //   s = fs.statSync(fullpath);
      // } catch (err) {
      //   return await next();
      // }
      if (!stat.isFile()) return await next();

      // file = loadFile(pathname, dir, options, files);

      const fileInfo = getFileInfo(fullpath);
      if (fileInfo) {
        files.set(pathname, fileInfo);
        file = fileInfo;
      }
    }

    ctx.status = 200;

    if (enableGzip) ctx.vary('Accept-Encoding');

    // if (!file.buffer) {
    //   var stats = await fs.stat(file.path);
    //   if (stats.mtime.getTime() !== file.mtime.getTime()) {
    //     file.mtime = stats.mtime;
    //     file.md5 = null;
    //     file.length = stats.size;
    //   }
    // }

    ctx.response.lastModified = file.modifyTime;
    if (file.md5) ctx.response.etag = file.md5;

    if (ctx.fresh) return (ctx.status = 304);

    ctx.type = getContentType(file);
    ctx.length = file.size;
    ctx.set('cache-control', file.cacheControl || 'public, max-age=' + (file.maxAge || 0));
    if (file.md5) ctx.set('content-md5', file.md5);

    if (ctx.method === 'HEAD') return;

    var acceptGzip = ctx.acceptsEncodings('gzip') === 'gzip';

    // if (file.zipBuffer) {
    //   if (acceptGzip) {
    //     ctx.set('content-encoding', 'gzip');
    //     ctx.body = file.zipBuffer;
    //   } else {
    //     ctx.body = file.buffer;
    //   }
    //   return;
    // }

    var shouldGzip = enableGzip && file.size > 1024 && acceptGzip && compressible(file.contentType);

    // if (file.buffer) {
    //   if (shouldGzip) {
    //     var gzFile = files.get(pathname + '.gz');
    //     if (options.usePrecompiledGzip && gzFile && gzFile.buffer) {
    //       // if .gz file already read from disk
    //       file.zipBuffer = gzFile.buffer;
    //     } else {
    //       file.zipBuffer = await zlib.gzip(file.buffer);
    //     }
    //     ctx.set('content-encoding', 'gzip');
    //     ctx.body = file.zipBuffer;
    //   } else {
    //     ctx.body = file.buffer;
    //   }
    //   return;
    // }

    let stream: stream.Readable;
    if (file.fullPath) {
      stream = fs.createReadStream(file.fullPath);
    } else {
      if (!file.buffer) {
        return await next();
      }
      stream = toStream(file.buffer);
    }

    // update file hash
    // if (!file.md5) {
    //   var hash = crypto.createHash('md5');
    //   stream.on('data', hash.update.bind(hash));
    //   stream.on('end', function () {
    //     file.md5 = hash.digest('base64');
    //   });
    // }

    ctx.body = stream;
    // enable gzip will remove content length
    if (shouldGzip) {
      ctx.remove('content-length');
      ctx.set('content-encoding', 'gzip');
      ctx.body = stream.pipe(zlib.createGzip());
    }
  };
}

function safeDecodeURIComponent(text: string) {
  try {
    return decodeURIComponent(text);
  } catch (e) {
    return text;
  }
}

/**
 * load file and add file content to cache
 *
 * @param {String} name
 * @param {String} dir
 * @param {Object} options
 * @param {Object} files
 * @return {Object}
 * @api private
 */

// function loadFile(name, dir, options, files) {
//   var pathname = path.normalize(path.join(options.prefix, name));
//   if (!files.get(pathname)) files.set(pathname, {});
//   var obj = files.get(pathname);
//   var filename = (obj.path = path.join(dir, name));
//   var stats = fs.statSync(filename);
//   var buffer = fs.readFileSync(filename);

//   obj.cacheControl = options.cacheControl;
//   obj.maxAge = obj.maxAge ? obj.maxAge : options.maxAge || 0;
//   obj.type = obj.mime = mime.lookup(pathname) || 'application/octet-stream';
//   obj.mtime = stats.mtime;
//   obj.length = stats.size;
//   obj.md5 = crypto.createHash('md5').update(buffer).digest('base64');

//   debug('file: ' + JSON.stringify(obj, null, 2));
//   if (options.buffer) obj.buffer = buffer;

//   buffer = null;
//   return obj;
// }

const FILE_SIZE_THRESHOLD = 1024 * 1024;

export function getFileInfo(fullPath: string, headerConfig?: IHttpHeaderConfig): IFileInfo | null {
  if (!fs.existsSync(fullPath)) {
    console.error(`file ${fullPath} not exist`);
    return null;
  }
  const stats = fs.statSync(fullPath);
  const extName = path.extname(fullPath);
  const contentType = mimeTypes.lookup(extName) || 'application/octet-stream';
  // const length = stats.size;
  return {
    fullPath,
    size: stats.size,
    modifyTime: stats.mtime,
    extName,
    contentType,
    ...(headerConfig ? headerConfig : {}),
  };
}
function getContentType(fileInfo: IFileInfo) {
  const {extName = '', contentType} = fileInfo;
  if (contentType) {
    return contentType;
  }
  return mimeTypes.lookup(extName) || 'application/octet-stream';
}

// function FileManager(store) {
//   if (store && typeof store.set === 'function' && typeof store.get === 'function') {
//     this.store = store
//   } else {
//     this.map = store || Object.create(null)
//   }
// }

// FileManager.prototype.get = function (key) {
//   return this.store ? this.store.get(key) : this.map[key]
// }

// FileManager.prototype.set = function (key, value) {
//   if (this.store) return this.store.set(key, value)
//   this.map[key] = value
// }

class FileManager implements IFileStore {
  map: IFileInfoMap = {};
  constructor() {
    this.map = {};
  }
  get(pathname: string) {
    return this.map[pathname];
  }
  set(pathname: string, info: IFileInfo) {
    this.map[pathname] = info;
  }
  keys() {
    return Object.keys(this.map);
  }
}
