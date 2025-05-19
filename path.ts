import fs from 'fs';
import path from 'path';

export function parseBasename(basename: string) {
  const extname = path.extname(basename);
  const bareBasename = path.basename(basename, extname);
  return {extname, bareBasename};
}
export function getFilePathInfo(filePath: string): {
  dirname: string;
  basename: string;
  extname: string;
  bareBasename: string;
} {
  const dirname = path.dirname(filePath);
  const basename = path.basename(filePath);
  const pathInfo = {
    dirname,
    basename,
    ...parseBasename(basename),
  };
  return pathInfo;
}
