type SyncDataSourceFn<T, Args extends any[]> = (...args: Args) => T;
type AsyncDataSourceFn<T, Args extends any[]> = (...args: Args) => Promise<T>;
type DataSourceFn<T, Args extends any[]> = SyncDataSourceFn<T, Args> | AsyncDataSourceFn<T, Args>;

/**
 * dataGenerator is the function to generate the data to be cached.
 */
export function cacheData<T, Args extends any[] = []>(
  options: {maxAge?: number},
  dataGenerator: DataSourceFn<T, Args>
) {
  // maxAge equal 0 means not do cache by default.
  const {maxAge = 0} = options;
  let data: T | undefined;
  let expireAt: number | undefined;
  let pending: Promise<T> | undefined;

  function isExpired() {
    return expireAt === undefined || Date.now() > expireAt;
  }

  async function set(...args: Args) {
    if (!pending) {
      pending = Promise.resolve(dataGenerator(...args));
    }
    try {
      data = await pending;
      expireAt = Date.now() + maxAge;
      return true;
    } catch {
      return false;
    } finally {
      pending = undefined;
    }
  }

  function setSync(...args: Args) {
    try {
      data = (dataGenerator as SyncDataSourceFn<T, Args>)(...args);
      expireAt = Date.now() + maxAge;
      return true;
    } catch {
      return false;
    }
  }

  function get(): T | undefined {
    return isExpired() ? undefined : data;
  }

  async function getOrFetch(...args: Args) {
    if (get() === undefined) {
      await set(...args);
    }
    return data;
  }

  function getOrFetchSync(...args: Args) {
    if (get() === undefined) {
      setSync(...args);
    }
    return data;
  }

  function getMeta() {
    return {expireAt};
  }

  return {set, setSync, get, getOrFetch, getOrFetchSync, getMeta};
}
