import {isFunction} from '../external';

type SyncGetDataSource<T> = T | ((...params: any[]) => T);
type ASyncGetDataSource<T> = (...params: any[]) => Promise<T>;
type GetDataSource<T> = SyncGetDataSource<T> | ASyncGetDataSource<T>;

export function useCachedData<T>(options: {maxAge?: number}, globalDataSource?: GetDataSource<T>) {
  // maxAge equal 0 means not do cache by default.
  const {maxAge = 0} = options;
  let data: T;
  let expireAt: number;
  let promise: Promise<T>;
  async function set(dataSource: GetDataSource<T>) {
    try {
      if (promise === undefined) {
        if (isFunction(dataSource)) {
          promise = (dataSource as (...params: any[]) => Promise<T>)();
        } else {
          promise = Promise.resolve(dataSource as T);
        }
      }
      data = await promise;
      expireAt = Date.now() + maxAge;
      return true;
    } catch (err) {
      return false;
    } finally {
      promise = undefined;
    }
  }
  function setSync(dataSource: SyncGetDataSource<T>) {
    try {
      if (isFunction(dataSource)) {
        data = (dataSource as (...params: any[]) => T)();
      } else {
        data = dataSource as T;
      }
      expireAt = Date.now() + maxAge;
      return true;
    } finally {
      return false;
    }
  }
  function get() {
    if (typeof expireAt === 'number' && Date.now() > expireAt) {
      return undefined;
    }
    return data;
  }
  async function getOrFetch(dataSource?: GetDataSource<T>) {
    if (get() === undefined) {
      await set(dataSource ?? globalDataSource);
    }
    return data;
  }
  /**
   * It only works when typeof globalDataSource is SyncGetDataSource<T>
   * @param dataSource
   * @returns
   */
  function getOrFetchSync(dataSource?: SyncGetDataSource<T>) {
    if (get() === undefined) {
      setSync(dataSource ?? (globalDataSource as SyncGetDataSource<T>));
    }
    return data;
  }
  function getMeta() {
    return {expireAt};
  }
  return {setSync, set, get, getOrFetch, getOrFetchSync, getMeta};
}
