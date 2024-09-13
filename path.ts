import fs from 'fs';
import path from 'path';

export function getFilePathInfo(filePath: string): {
  dirname: string;
  basename: string;
  extname: string;
  bareBasename: string;
} {
  const dirname = path.dirname(filePath);
  const basename = path.basename(filePath);
  const extname = path.extname(basename);
  const bareBasename = path.basename(basename, extname);
  const pathInfo = {
    dirname,
    basename,
    extname,
    bareBasename,
  };
  return pathInfo;
}
