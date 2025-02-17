import fs from 'fs';

/**
 * Spawn .js file first if exist, as .ts file will cost more resource
 * @param fullPath
 * @returns
 */
export function tryUseJsFile(fullPath: string) {
  let jsFilePath: string;
  if (fullPath.endsWith('.ts')) {
    jsFilePath = fullPath.replace(/ts$/, 'js');
  }
  if (jsFilePath && fs.existsSync(jsFilePath)) {
    return jsFilePath;
  }
  return fullPath;
}
