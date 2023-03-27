import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import stream = require('stream');
import {readDirRecursive} from '../path';
import Koa from 'koa';
import {toStream} from '../stream';
import {compressible} from '../mime/mime-types';

/**
 * Key points:
 * pathname meaning: /path/a, /path/a/
 */
export interface IFileStore {
  get(pathname: string): TargetInfo | null;
  set(pathname: string, info: TargetInfo): void;
  remove(pathname: string): boolean;
  all(): {[pathname: string]: TargetInfo};
}

export interface IStaticMiddlewareOptions {
  /** target static dir */
  dir: string;
  /** urlPrefix will be replace to '' whne found a file by pathname */
  urlPrefix?: string;
  /** load all files at start of the server, set false as default to avoid too many time cost and memory cost */
  // preLoad?: boolean;
  // /** try to find the file from local when it not exist in store */
  // dynamic?: boolean;
  store?: IFileStore;
  /** enable gzip or not */
  enableGzip?: boolean;
  /** alias a pathname to another name before load file */
  alias?: {
    [pathname: string]: string;
  };
  /** when the target path point to is dir, how to handle it */
  handleDir?: (fullpath: string) => BufferInfo;
  /** return a new contentType from origin contentType */
  customContentType?: (fileInfo: LocalFileInfo) => string | undefined;
  /** handle data and return new data */
  postTreatData?: (stream: stream.Readable, fileInfo: TargetInfo) => stream.Readable;
  maxCacheTime?: number;
}

interface IHttpHeaderConfig {
  maxAge?: number;
  cacheControl?: string;
}

interface ICommonInfo extends IHttpHeaderConfig {
  size: number;
  modifyTime: Date;
  md5?: string;
  timestamp: number;
}
export interface LocalFileInfo extends ICommonInfo {
  /** fullpath for local file, buffer for generated file */
  fullPath: string;
  extName: string;
}
export interface BufferInfo extends ICommonInfo {
  buffer: Buffer;
  contentType: string;
}
export type TargetInfo = LocalFileInfo | BufferInfo;

/**
 * A middleware of koa for handle static files under a target folder.
 */
export default function staticCache(options: IStaticMiddlewareOptions) {
  let {
    dir,
    urlPrefix = '/',
    store,
    enableGzip = false,
    alias = {},
    handleDir,
    postTreatData,
    customContentType,
    maxCacheTime = 0,
  } = options;

  const getContentType = (fileInfo: LocalFileInfo | BufferInfo) => {
    if (customContentType && (fileInfo as LocalFileInfo).extName) {
      const contentType = customContentType(fileInfo as LocalFileInfo);
      if (contentType) {
        return contentType;
      }
    }
    // @ts-ignore
    const {extName, contentType} = fileInfo;
    return extName || contentType || 'application/octet-stream';
  };

  dir = path.normalize(dir);
  if (!fs.existsSync(dir)) {
    throw new Error(`dir ${dir} not exist!`);
  }

  if (!urlPrefix.startsWith('/')) {
    throw new Error(`urlPrefix should starts with '/': ${urlPrefix}`);
  }
  urlPrefix =
    '/' +
    urlPrefix
      .split('/')
      .filter(it => it)
      .join('/');

  const fileStore = store ? store : new FileManager();

  return async (ctx: Koa.Context, next: Koa.Next) => {
    // only accept HEAD and GET
    if (ctx.method !== 'HEAD' && ctx.method !== 'GET') {
      return await next();
    }
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

    const relativePath = pathname.replace(urlPrefix, '');
    const fullpath = path.join(dir, relativePath);
    let fileInfo = fileStore.get(pathname);
    // console.log(`pathname`);
    // console.log(pathname);
    // console.log(file);
    // console.log(file.buffer ? file.buffer.toString() : file.fullPath);
    // try to load file
    if (!fileInfo) {
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

      const _fileInfo = getFileInfo(fullpath, {handleDir});
      if (_fileInfo) {
        fileStore.set(pathname, _fileInfo);
        fileInfo = _fileInfo;
      }
    } else {
      /** check whether fullpath exist in local storage */
      if (!fs.existsSync(fullpath)) {
        fileStore.remove(fullpath);
        return await next();
      } else if (maxCacheTime && fileInfo.timestamp + maxCacheTime > Date.now()) {
        const _fileInfo = getFileInfo(fullpath, {handleDir});
        if (_fileInfo) {
          fileStore.set(pathname, _fileInfo);
          fileInfo = _fileInfo;
        }
      }
    }
    if (!fileInfo) {
      return await next();
    }

    ctx.status = 200;

    if (enableGzip) {
      ctx.vary('Accept-Encoding');
    }

    ctx.response.lastModified = fileInfo.modifyTime;
    if (fileInfo.md5) {
      ctx.response.etag = fileInfo.md5;
    }

    if (ctx.fresh) {
      return (ctx.status = 304);
    }

    ctx.type = getContentType(fileInfo);
    // should not set length as it may be compressed later
    // ctx.length = file.size;
    ctx.set('cache-control', fileInfo.cacheControl || 'public, max-age=' + (fileInfo.maxAge || 0));
    if (fileInfo.md5) {
      ctx.set('content-md5', fileInfo.md5);
    }

    if (ctx.method === 'HEAD') {
      return;
    }

    var acceptGzip = ctx.acceptsEncodings('gzip') === 'gzip';

    var shouldGzip =
      enableGzip && fileInfo.size > 1024 && acceptGzip && compressible(getContentType(fileInfo));

    let stream: stream.Readable;
    if ((fileInfo as LocalFileInfo).fullPath) {
      stream = fs.createReadStream((fileInfo as LocalFileInfo).fullPath);
    } else if (fileInfo as BufferInfo) {
      stream = toStream((fileInfo as BufferInfo).buffer);
    }
    if (postTreatData) {
      stream = postTreatData(stream, fileInfo);
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
    handleDir?: IStaticMiddlewareOptions['handleDir'];
  } = {},
  headerConfig?: IHttpHeaderConfig
): TargetInfo | null {
  if (!fs.existsSync(fullPath)) {
    console.error(`file ${fullPath} not exist`);
    return null;
  }
  const {handleDir} = option;
  const stats = fs.statSync(fullPath);
  if (stats.isFile()) {
    const extName = path.extname(fullPath);
    return {
      fullPath,
      size: stats.size,
      modifyTime: stats.mtime,
      extName,
      timestamp: Date.now(),
      ...(headerConfig ? headerConfig : {}),
    };
  } else if (stats.isDirectory() && handleDir) {
    return handleDir(fullPath);
  }
  return null;
}

interface IFileInfoMap {
  [pathname: string]: LocalFileInfo;
}

class FileManager implements IFileStore {
  map: IFileInfoMap = {};
  constructor() {
    this.map = {};
  }
  get(pathname: string) {
    return this.map[pathname];
  }
  set(pathname: string, info: LocalFileInfo) {
    this.map[pathname] = info;
  }
  remove(pathname: string) {
    if (Object.prototype.hasOwnProperty.call(this.map, pathname)) {
      delete this.map[pathname];
      return true;
    }
    return false;
  }
  all() {
    return this.map;
  }
}

export function preLoadDir(
  store: IFileStore,
  dirInfo: {
    fullPath: string;
    includeDir?: boolean;
    dirFilter?: (fullpath: string) => boolean;
    fileFilter?: (fullpath: string) => boolean;
  },
  urlPrefix: string
) {
  if (!urlPrefix) {
    urlPrefix = '';
  }
  const {fullPath, dirFilter, fileFilter, includeDir} = dirInfo;
  if (!fs.existsSync(fullPath)) {
    throw new Error(`dir "${fullPath}" not exist`);
  }
  const stat = fs.statSync(fullPath);
  if (!stat.isDirectory()) {
    throw new Error(`dir "${fullPath}" is not a directory`);
  }
  readDirRecursive(fullPath, {
    dirFilter,
    fileFilter,
    includeDir,
  }).forEach(relativePath => {
    const fileInfo = getFileInfo(path.join(fullPath, relativePath));
    if (fileInfo) {
      store.set(path.join(urlPrefix, relativePath), fileInfo);
    }
  });
}
