import {isNumber} from '../../../external';
import {
  DeleteResponseStatus,
  ErrorMessage,
  ErrorStatus,
  SaveCommandName,
  SaveResponseStatus,
  StoreApi,
} from '../service/types';
import {getError, isOutdate, stringifyRecordItem} from './service';
import {RecordItem} from '../service/types';

export class Store implements StoreApi {
  record: Map<string, RecordItem>;
  /** include both outdate and no-outdate */
  totalSize: number;
  maxSizeMb: number;
  maxCount: number;
  constructor() {
    this.record = new Map();
    this.totalSize = 0;
    this.maxSizeMb = 100 << 20;
    this.maxCount = 100;
  }
  contains(key: string, includeOutdate?: boolean) {
    if (!this.record.has(key)) {
      return false;
    }
    const {expiration} = this.record.get(key);
    return includeOutdate || !isOutdate(expiration);
  }
  store(action: SaveCommandName, key: string, item: RecordItem): SaveResponseStatus | ErrorMessage {
    const recordByKey = this.get(key);
    /** Not consider outdate */
    const valueOfKey = this.get(key, true);
    process.nextTick(() => this.purge());
    switch (action) {
      case 'set':
        {
          this.record.set(key, item);
          this.totalSize -= valueOfKey ? valueOfKey.bytes : 0;
          this.totalSize += item.bytes;
        }
        break;
      case 'add':
        {
          if (recordByKey) {
            return SaveResponseStatus.NOT_STORED;
          }
          this.record.set(key, item);
          this.totalSize += item.bytes;
        }
        break;
      case 'replace':
        {
          if (!recordByKey) {
            return SaveResponseStatus.NOT_STORED;
          }
        }
        break;
      case 'append':
      case 'prepend':
        {
          if (!recordByKey) {
            return SaveResponseStatus.NOT_STORED;
          }
          const {value} = recordByKey;
          recordByKey.value =
            action === 'append' ? Buffer.concat([item.value, value]) : Buffer.concat([value, item.value]);
          this.totalSize += item.bytes;
        }
        break;
      case 'cas': {
        const {casId} = item;
        if (casId === undefined) {
          return getError(ErrorStatus.CLIENT_ERROR, 'cas id is not set');
        }
        if (!recordByKey || recordByKey.casId === undefined || recordByKey.casId !== casId) {
          return SaveResponseStatus.NOT_FOUND;
        }
        this.record.set(key, item);
        this.totalSize -= valueOfKey ? valueOfKey.bytes : 0;
        this.totalSize += item.bytes;
        return SaveResponseStatus.EXISTS;
      }
      default: {
        return getError(ErrorStatus.CLIENT_ERROR, `Command ${action} not support `);
      }
    }
    return SaveResponseStatus.STORED;
  }
  set(key: string, item: RecordItem) {
    return this.store('set', key, item);
  }
  add(key: string, item: RecordItem) {
    return this.store('add', key, item);
  }
  replace(key: string, item: RecordItem) {
    return this.store('replace', key, item);
  }
  append(key: string, item: RecordItem) {
    return this.store('append', key, item);
  }
  prepend(key: string, item: RecordItem) {
    return this.store('prepend', key, item);
  }
  cas(key: string, item: RecordItem) {
    return this.store('cas', key, item);
  }
  /**
   * VALUE <key> <flags> <bytes> [<cas unique>]\r\n
   * <data block>\r\n
   */
  gets(keys: string[], includeOutdate?: boolean): {[key: string]: RecordItem} {
    return keys.reduce<{[key: string]: RecordItem}>((sum, key) => {
      if (!this.contains(key, includeOutdate)) {
        return sum;
      }
      return {
        ...sum,
        [key]: this.record.get(key),
      };
    }, {});
  }
  get(key: string, includeOutdate?: boolean): RecordItem {
    const obj = this.gets([key], includeOutdate);
    return obj[key];
  }

  delete(key: string) {
    if (!this.record.has(key)) {
      return DeleteResponseStatus.NOT_FOUND;
    }
    const byteLength = this.record.get(key).bytes;
    this.record.delete(key);
    this.totalSize -= byteLength;
    return DeleteResponseStatus.DELETED;
  }
  purge() {
    if (this.record.size > this.maxCount) {
      for (const [key, value] of Object.entries(this.record)) {
        if (isOutdate(value.expiration)) {
          this.delete(key);
        }
      }
    }
    for (const [key] of Object.entries(this.record)) {
      if (this.record.size > this.maxCount || this.totalSize > this.maxSizeMb) {
        this.delete(key);
      } else {
        break;
      }
    }
  }
  toArray() {
    return [...this.record.entries()];
  }
  toJSON() {
    const items = this.toArray();
    return items.reduce<{[key: string]: Record<string, any>}>((sum, [key, value]) => {
      return {
        ...sum,
        [key]: stringifyRecordItem(value),
      };
    }, {});
  }
}
