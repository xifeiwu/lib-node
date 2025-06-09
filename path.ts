import fs from 'fs';
import path from 'path';
import {FilePathSegement} from './types';
import {formatDate} from './external';

export function parseBasename(basename: string) {
  const extname = path.extname(basename);
  const bareBasename = path.basename(basename, extname);
  return {extname, bareBasename};
}

/**
params: ['zMovie/modules/lib/node/path.test.ts'],
expected: {
  dirname: 'zMovie/modules/lib/node',
  basename: 'path.test.ts',
  bareBasename: 'path.test',
  extname: '.ts',
},
 */
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

export function getPathWithBasenaneSuffix(fullPath: string, suffix: string) {
  const {dirname, bareBasename, extname} = getFilePathInfo(fullPath);
  return path.join(dirname, bareBasename + suffix + extname);
}

/**
 * get full path with bareBasename suffixed with date-time string
 */
export function getPathWithDtSuffix(fullPath: string) {
  const suffix = formatDate(new Date(), '-yyyy-MM-ddThh:mm:ss');
  return getPathWithBasenaneSuffix(fullPath, suffix);
}

export function getDtFromPath(fullPath: string) {
  const {bareBasename} = getFilePathInfo(fullPath);
  const reg = /[\d]{4,4}-[\d]{2,2}-[\d]{2,2}T[\d]{2,2}:[\d]{2,2}:[\d]{2,2}$/;
  const execResult = reg.exec(bareBasename);
  if (!execResult) {
    return null;
  }
  const [dateTimeStr] = execResult;
  return new Date(dateTimeStr);
}
