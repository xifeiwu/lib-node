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
  dirFilter?: (fullpath: string) => boolean;
  fileFilter?: (fullpath: string) => boolean;
  store?: IFileStore;
  enableGzip?: boolean;
  alias?: {
    [pathname: string]: string;
  };
  handleDir?: (fullpath: string) => IFileInfo;
  customContentType?: (extName: string) => string | undefined;
  postTreatStream?: (stream: stream.Readable, fileInfo: IFileInfo) => stream.Readable;
}

interface IHttpHeaderConfig {
  maxAge?: number;
  cacheControl?: string;
}

export interface IFileInfo extends IHttpHeaderConfig {
  /** fullPath of the file, customed data does not have fullPath */
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
    /** set false as default value to avoid unnoticeable too many time cost in top dir  */
    preLoad = false,
    dynamic = true,
    alias = {},
    handleDir,
    postTreatStream,
    customContentType,
  } = options;

  const getContentType = (fileInfo: IFileInfo) => {
    const {extName = '', contentType} = fileInfo;
    if (customContentType) {
      const contentType = customContentType(extName);
      if (contentType) {
        return contentType;
      }
    }
    if (contentType) {
      return contentType;
    }
    return mimeTypes.lookup(extName) || 'application/octet-stream';
  };
  dir = path.normalize(dir);
  urlPrefix = `/${urlPrefix
    .split('/')
    .filter(it => it)
    .join('/')}`;

  const files = store ? store : new FileManager();

  if (!fs.existsSync(dir)) {
    throw new Error(`dir ${dir} not exist!`);
  }

  if (preLoad) {
    readDirRecursive(dir, {
      dirFilter: dirFilter,
      fileFilter: fileFilter,
      includeDir: true,
    }).forEach(relativePath => {
      const fileInfo = getFileInfo(path.join(dir, relativePath), {
        handleDir,
      });
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
    if (alias && alias[pathname]) {
      pathname = alias[pathname];
    }
    // check prefix first to avoid calculate
    if (pathname.indexOf(urlPrefix) !== 0) {
      return await next();
    }

    let file = files.get(pathname);
    // console.log(`pathname`);
    // console.log(pathname);
    // console.log(file);
    // console.log(file.buffer ? file.buffer.toString() : file.fullPath);
    // try to load file
    if (!file) {
      if (!dynamic) {
        return await next();
      }
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
      /** only support file or directory */
      if (!stat.isFile() && !stat.isDirectory()) {
        return await next();
      }

      const fileInfo = getFileInfo(fullpath, {handleDir});
      if (fileInfo) {
        files.set(pathname, fileInfo);
        file = fileInfo;
      }
    }
    if (!file) {
      return await next();
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
    if (postTreatStream) {
      stream = postTreatStream(stream, file);
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

/**
 *
 * @param fullPath
 * @param option
 * @param headerConfig config for http header
 * @returns
 */
export function getFileInfo(
  fullPath: string,
  option: {
    /** return content of buffer when path points to a directory */
    handleDir?: IOptions['handleDir'];
  } = {},
  headerConfig?: IHttpHeaderConfig
): IFileInfo | null {
  if (!fs.existsSync(fullPath)) {
    console.error(`file ${fullPath} not exist`);
    return null;
  }
  const {handleDir} = option;
  const stats = fs.statSync(fullPath);
  if (stats.isFile()) {
    const extName = path.extname(fullPath);
    const contentType = mimeTypes.lookup(extName) || 'application/octet-stream';
    return {
      fullPath,
      size: stats.size,
      modifyTime: stats.mtime,
      extName,
      contentType,
      ...(headerConfig ? headerConfig : {}),
    };
  } else if (stats.isDirectory() && handleDir) {
    return handleDir(fullPath);
  }
  return null;
  // const length = stats.size;
}

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

export function preLoadDir(dir: string, store: IFileStore, urlPrefix: string) {
  if (!urlPrefix) {
    urlPrefix = '';
  }
  if (!fs.existsSync(dir)) {
    throw new Error(`dir "${dir}" not exist`);
  }
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    throw new Error(`dir "${dir}" is not a directory`);
  }
  readDirRecursive(dir, {
    includeDir: false,
  }).forEach(relativePath => {
    const fileInfo = getFileInfo(path.join(dir, relativePath));
    if (fileInfo) {
      store.set(path.join(urlPrefix, relativePath), fileInfo);
    }
  });
}
