import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import stream = require('stream');
import {readDirRecursive} from '../path';
import Koa from 'koa';
import {toStream} from '../stream';
import {compressible} from '../mime/mime-types';

export interface IFileStore {
  get(pathname: string): IFileInfo;
  set(pathname: string, info: IFileInfo): void;
}

interface IOptions {
  /** target static dir */
  dir: string;
  /** urlPrefix will be replace to '' whne found a file by pathname */
  urlPrefix?: string;
  /** load all files at start of the server, set false as default to avoid too many time cost and memory cost */
  preLoad?: boolean;
  /** try to find the file from local when it not exist in store */
  dynamic?: boolean;
  dirFilter?: (fullpath: string) => boolean;
  fileFilter?: (fullpath: string) => boolean;
  store?: IFileStore;
  /** enable gzip or not */
  enableGzip?: boolean;
  /** alias a pathname to another name before load file */
  alias?: {
    [pathname: string]: string;
  };
  /** when the target path point to is dir, how to handle it */
  handleDir?: (fullpath: string) => IFileInfo;
  /** return a new contentType from origin contentType */
  customContentType?: (extName: string) => string | undefined;
  /** handle data and return new data */
  postTreatData?: (stream: stream.Readable, fileInfo: IFileInfo) => stream.Readable;
}

interface IHttpHeaderConfig {
  maxAge?: number;
  cacheControl?: string;
}

export interface IFileInfo extends IHttpHeaderConfig {
  /** fullPath of the file, customed data does not have fullPath */
  fullPath?: string;
  extName?: string;
  /** file content can be found by fullPath or return this buffer */
  buffer?: Buffer;
  contentType?: string;
  size: number;
  modifyTime: Date;
  md5?: string;
}

/**
 * A middleware of koa for handle static files under a target folder.
 */
export default function staticCache(options: IOptions) {
  let {
    dir = process.cwd(),
    urlPrefix = '/',
    store,
    enableGzip = true,
    dirFilter,
    fileFilter,
    preLoad = false,
    dynamic = true,
    alias = {},
    handleDir,
    postTreatData,
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
    return extName || 'application/octet-stream';
  };
  dir = path.normalize(dir);
  urlPrefix =
    '/' +
    urlPrefix
      .split('/')
      .filter(it => it)
      .join('/');

  const fileStore = store ? store : new FileManager();

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
        fileStore.set(path.join(urlPrefix, relativePath), fileInfo);
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

    let file = fileStore.get(pathname);
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
        fileStore.set(pathname, fileInfo);
        file = fileInfo;
      }
    }
    if (!file) {
      return await next();
    }

    ctx.status = 200;

    if (enableGzip) {
      ctx.vary('Accept-Encoding');
    }

    // if (!file.buffer) {
    //   var stats = await fs.stat(file.path);
    //   if (stats.mtime.getTime() !== file.mtime.getTime()) {
    //     file.mtime = stats.mtime;
    //     file.md5 = null;
    //     file.length = stats.size;
    //   }
    // }

    ctx.response.lastModified = file.modifyTime;
    if (file.md5) {
      ctx.response.etag = file.md5;
    }

    if (ctx.fresh) {
      return (ctx.status = 304);
    }

    ctx.type = getContentType(file);
    // should not set length as it may be compressed later
    // ctx.length = file.size;
    ctx.set('cache-control', file.cacheControl || 'public, max-age=' + (file.maxAge || 0));
    if (file.md5) {
      ctx.set('content-md5', file.md5);
    }

    if (ctx.method === 'HEAD') {
      return;
    }

    var acceptGzip = ctx.acceptsEncodings('gzip') === 'gzip';

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
    if (postTreatData) {
      stream = postTreatData(stream, file);
    }

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
    const contentType = extName || 'application/octet-stream';
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
}

interface IFileInfoMap {
  [pathname: string]: IFileInfo;
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
