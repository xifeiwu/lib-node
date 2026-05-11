import {isFunction, isObject} from '../external';
import fs from 'fs';
import path from 'path';
import {pathToFileURL} from 'url';

/**
 * Determine if a value is a Stream
 *
 * @param {*} val The value to test
 *
 * @returns {boolean} True if value is a Stream, otherwise false
 */
export const isStream = val => isObject(val) && isFunction(val.pipe);

export async function calDuration<T>(promise: Promise<T>) {
  const start = Date.now();
  const res = await promise;
  const end = Date.now();
  console.log(`time used ${end - start}`);
  return res;
}

export function rerequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

function getClosestPackageJson(filePath: string): string | undefined {
  let dir = fs.statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);

  while (true) {
    const packageJson = path.join(dir, 'package.json');
    if (fs.existsSync(packageJson)) {
      return packageJson;
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

export function isTypeModulePackageFile(modulePath: string): boolean {
  const packageJson = getClosestPackageJson(modulePath);
  if (!packageJson) return false;

  const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
  return packageInfo.type === 'module';
}

async function nativeImport(modulePath: string) {
  const importFunc = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<any>;
  return await importFunc(pathToFileURL(modulePath).href);
}

export async function reimportOrRequire(modulePath: string) {
  if (isTypeModulePackageFile(modulePath)) {
    return await nativeImport(modulePath);
  }
  return rerequire(modulePath);
}
