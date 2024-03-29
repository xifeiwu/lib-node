import {ErrorMessage, Command4Set, Status4Set, RecordItem} from '../service/types';

type StorageSetFunc = (key: string, item: RecordItem) => Status4Set | ErrorMessage;
export type StorageAction = {
  [key in Command4Set]: StorageSetFunc;
};
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
