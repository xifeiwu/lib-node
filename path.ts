import fs from 'fs';
import path from 'path';
import {FilePathSegement} from './types';
import {formatDate, getDtStrInFormat} from './external';
import {isFileExist} from './fs';

export function parseBasename(basename: string) {
  const extname = path.extname(basename);
  const bareBasename = path.basename(basename, extname);
  return {extname, bareBasename};
}

// params: ['zMovie/modules/lib/node/path.test.ts'],
// expected: {
//   dirname: 'zMovie/modules/lib/node',
//   basename: 'path.test.ts',
//   bareBasename: 'path.test',
//   extname: '.ts',
// },
export function getFilePathInfo(filePath: string): FilePathSegement {
  const dirname = path.dirname(filePath);
  const basename = path.basename(filePath);
  const pathInfo = {
    dirname,
    basename,
    ...parseBasename(basename),
  };
  return pathInfo;
}

export function convertBareBasename(
  filePath: string,
  convert: (info: FilePathSegement) => string
  // options?: {action: 'add' | 'remove'; prefix?: string; suffix: string}
) {
  const pathInfo = getFilePathInfo(filePath);
  const newBareBaseame = convert(pathInfo);
  const {extname, dirname} = pathInfo;
  return path.join(dirname, newBareBaseame + extname);
}

export function addSuffixToBareBasename(filePath: string, suffix: string) {
  return convertBareBasename(filePath, ({bareBasename}) => {
    return bareBasename + suffix;
  });
}

/**
 * @deprecated by addSuffixToBareBasename
 * @param fullPath
 * @param suffix
 * @returns
 */
export function getPathWithBasenameSuffix(fullPath: string, suffix: string) {
  const {dirname, bareBasename, extname} = getFilePathInfo(fullPath);
  return path.join(dirname, bareBasename + suffix + extname);
}

/**
 * @deprecated by addDtSuffixToBareBasename
 * get full path with bareBasename suffixed with date-time string
 */
export function getPathWithDtSuffix(filePath: string) {
  const suffix = formatDate(new Date(), 'yyyy-MM-ddThh:mm:ss');
  return addSuffixToBareBasename(filePath, suffix);
}

export function addDtSuffixToBareBasename(
  filePath,
  options?: {
    dtFormat?: string;
    dt?: string | number | Date;
  }
) {
  const dtSuffix = getDtStrInFormat(options?.dtFormat, options?.dt);
  return addSuffixToBareBasename(filePath, dtSuffix);
}

/*
 * @deprecated by getDtFromBasename
 * @param filePath
 * @returns
 */
export function getDtFromPath(filePath: string) {
  const {bareBasename} = getFilePathInfo(filePath);
  const reg = /[\d]{4,4}-[\d]{2,2}-[\d]{2,2}T[\d]{2,2}:[\d]{2,2}:[\d]{2,2}$/;
  const execResult = reg.exec(bareBasename);
  if (!execResult) {
    return null;
  }
  const [dateTimeStr] = execResult;
  return new Date(dateTimeStr);
}
export function getDtFromBasename(filePath: string) {
  return getDtFromPath(filePath);
}

export function isDirFormat(fullPath: string) {
  return fullPath.endsWith('/');
}
export function getDir(fullPath: string) {
  const isDir = isDirFormat(fullPath);
  return isDir ? fullPath : path.dirname(fullPath);
}

export function isDirExistForFile(fullPath: string) {
  const isDir = isDirFormat(fullPath);
  const dirname = isDir ? fullPath : path.dirname(fullPath);
  return fs.existsSync(dirname);
}

/**
 * @param dirpath
 * if dirpath not exist, create this dir. if dirpath exist but is not a directory, throw Error
 */
export function makeSureDirExist(
  dirpath: string,
  /**
   * @deprecated will deprecate options
   */
  options?: {
    /**
     * @deprecated will deprecate options
     */
    isDir?: boolean;
  }
) {
  const stat = isFileExist(dirpath);
  if (!stat) {
    fs.mkdirSync(dirpath, {recursive: true});
    return true;
  }
  if (!stat.isDirectory()) {
    throw new Error(`dir(${dirpath}) exist but is not a directory`);
  }
  return true;
}
/**
 * Make sure dirPath of @param filePath exist
 */
export function makeSureDirExistForFile(filePath: string) {
  const {dirname} = getFilePathInfo(filePath);
  return makeSureDirExist(dirname);
}
