import {isFunction, isObject} from '../external';
import {isEsmPackage} from '../fs';
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

async function nativeImport(modulePath: string) {
  const importFunc = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<any>;
  return await importFunc(pathToFileURL(modulePath).href);
}

export async function reimportOrRequire(modulePath: string) {
  if (isEsmPackage(modulePath)) {
    return await nativeImport(modulePath);
  }
  return rerequire(modulePath);
}
