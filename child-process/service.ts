import fs from 'fs';

/**
 * For the case .ts file compiled to .js file, will use .js file first when running logic for the consideration of saving cost.
 */
export function tryUseJsFile(scriptPath: string) {
  let jsFilePath: string;
  if (scriptPath.endsWith('.ts')) {
    jsFilePath = scriptPath.replace(/ts$/, 'js');
  }
  if (jsFilePath && fs.existsSync(jsFilePath)) {
    return jsFilePath;
  }
  return scriptPath;
}
