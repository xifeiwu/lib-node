import {ErrorMessage, Flag, StorageStatus} from '../types';

export interface Item {
  flag: Flag;
  expiration: number;
  casId?: string;
  bytes: number;
  value: string;
}


// interface StorageActionHandler<Item> {
//   // records: {
//   //   has: (key: string) => boolean;
//   //   get: (key: string) => Item | undefined;
//   // }
//   set: (key: string, flags: string, exptime: string, bytes: string) => StorageStatus;
// }
// export interface Params extends Pick<Item, 'value' | 'flag'> {
//   action: Action;
//   expirationSeconds: number;
// }
