// import { Params } from "./types";

import {isNumber} from '../../../external';
import {ErrorMessage, ErrorStatus, Command4Set, Status4Set} from '../service/types';
import {getError} from './service';
import {RecordItem} from '../service/types';
import {StorageAction} from './types';

export class Storage implements StorageAction {
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
  remove(key) {
    if (!this.record.has(key)) {
      return false;
    }
    const byteLength = this.record.get(key).bytes;
    this.record.delete(key);
    this.currentSize == byteLength;
    return true;
  }
  isOutdate(expiration: number) {
    if (!isNumber(expiration)) {
      return true;
    }
    if (expiration > 0 && expiration > Date.now()) {
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
  update(action: Command4Set, key: string, item: RecordItem): Status4Set | ErrorMessage {
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
            return Status4Set.NOT_STORED;
          }
          this.record.set(key, item);
        }
        break;
      case 'replace':
        {
          if (!exist) {
            return Status4Set.NOT_STORED;
          }
        }
        break;
      case 'append':
      case 'prepend':
        {
          if (!record) {
            return Status4Set.NOT_STORED;
          }
          const {value} = record;
          record.value = action === 'append' ? `${item.value}{value}` : `{value}${item.value}`;
        }
        break;
      case 'cas': {
        const {casId} = item;
        if (casId === undefined) {
          return getError(ErrorStatus.CLIENT_ERROR, 'cas id is not set');
        }
        if (!record || record.casId === undefined || record.casId !== casId) {
          return Status4Set.NOT_FOUND;
        }
        this.record.set(key, item);
        return Status4Set.EXISTS;
      }
      default: {
        return getError(ErrorStatus.CLIENT_ERROR, `Command ${action} not support `);
      }
    }
    return Status4Set.STORED;
  }
  set(key: string, item: RecordItem) {
    return this.update('set', key, item);
  }
  add(key: string, item: RecordItem) {
    return this.update('add', key, item);
  }
  replace(key: string, item: RecordItem) {
    return this.update('replace', key, item);
  }
  append(key: string, item: RecordItem) {
    return this.update('append', key, item);
  }
  prepend(key: string, item: RecordItem) {
    return this.update('prepend', key, item);
  }
  cas(key: string, item: RecordItem) {
    return this.update('cas', key, item);
  }
  purge() {
    if (this.record.size > this.maxCount) {
      for (const [key, value] of Object.entries(this.record)) {
        if (this.isOutdate(value.expiration)) {
          this.remove(key);
        }
      }
    }
    for (const [key] of Object.entries(this.record)) {
      if (this.record.size > this.maxCount || this.currentSize > this.maxSizeMb) {
        this.remove(key);
      } else {
        break;
      }
    }
  }
  get(keys: string[]): {[key: string]: RecordItem} {
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
}

export const store = new Storage();
