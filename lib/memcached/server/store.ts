import {isNumber} from '../../../external';
import {
  DeleteResponseStatus,
  ErrorMessage,
  ErrorStatus,
  SaveCommandName,
  SaveResponseStatus,
  StoreApi,
} from '../service/types';
import {getError, stringifyRecordItem} from './service';
import {RecordItem} from '../service/types';

export class Store implements StoreApi {
  record: Map<string, RecordItem>;
  currentSize: number;
  maxSizeMb: number;
  maxCount: number;
  constructor() {
    this.record = new Map();
    this.currentSize = 0;
    this.maxSizeMb = 100;
    this.maxCount = 100;
  }
  isOutdate(expiration: number) {
    if (!isNumber(expiration)) {
      return true;
    }
    if (expiration > 0 && expiration < Date.now()) {
      return true;
    }
    return false;
  }
  contains(key: string) {
    if (!this.record.has(key)) {
      return false;
    }
    const {expiration} = this.record.get(key);
    return !this.isOutdate(expiration);
  }
  store(action: SaveCommandName, key: string, item: RecordItem): SaveResponseStatus | ErrorMessage {
    const exist = this.contains(key);
    const record = exist ? this.record.get(key) : null;
    process.nextTick(() => this.purge());
    switch (action) {
      case 'set':
        {
          this.record.set(key, item);
        }
        break;
      case 'add':
        {
          if (exist) {
            return SaveResponseStatus.NOT_STORED;
          }
          this.record.set(key, item);
        }
        break;
      case 'replace':
        {
          if (!exist) {
            return SaveResponseStatus.NOT_STORED;
          }
        }
        break;
      case 'append':
      case 'prepend':
        {
          if (!record) {
            return SaveResponseStatus.NOT_STORED;
          }
          const {value} = record;
          record.value =
            action === 'append' ? Buffer.concat([item.value, value]) : Buffer.concat([value, item.value]);
        }
        break;
      case 'cas': {
        const {casId} = item;
        if (casId === undefined) {
          return getError(ErrorStatus.CLIENT_ERROR, 'cas id is not set');
        }
        if (!record || record.casId === undefined || record.casId !== casId) {
          return SaveResponseStatus.NOT_FOUND;
        }
        this.record.set(key, item);
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
  gets(keys: string[]): {[key: string]: RecordItem} {
    return keys.reduce<{[key: string]: RecordItem}>((sum, key) => {
      if (!this.contains(key)) {
        return sum;
      }
      return {
        ...sum,
        [key]: this.record.get(key),
      };
    }, {});
  }
  get(key): RecordItem {
    const obj = this.gets([key]);
    return obj[key];
  }

  delete(key: string) {
    if (!this.record.has(key)) {
      return DeleteResponseStatus.NOT_FOUND;
    }
    const byteLength = this.record.get(key).bytes;
    this.record.delete(key);
    this.currentSize == byteLength;
    return DeleteResponseStatus.DELETED;
  }
  purge() {
    if (this.record.size > this.maxCount) {
      for (const [key, value] of Object.entries(this.record)) {
        if (this.isOutdate(value.expiration)) {
          this.delete(key);
        }
      }
    }
    for (const [key] of Object.entries(this.record)) {
      if (this.record.size > this.maxCount || this.currentSize > this.maxSizeMb) {
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
    return items.reduce<{[key: string]: Record<string, string | number>}>((sum, [key, value]) => {
      return {
        ...sum,
        [key]: stringifyRecordItem(value),
      };
    }, {});
  }
}
