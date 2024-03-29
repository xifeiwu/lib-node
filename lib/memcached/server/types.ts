// import {ErrorMessage, Command4Store, Status4Store, RecordItem, Command4Get} from '../service/types';

// type StoreFunc = (key: string, item: RecordItem) => Status4Store | ErrorMessage;
// type GetFunc = (keys: string[]) => {[key: string]: RecordItem}
// export type AllStorageFunc = {
//   [key in Command4Store]: StoreFunc;
// };
// export type AllGetFunc = {
//   [key in Command4Get]: GetFunc;
// }
// export interface StoreApi extends AllStorageFunc, AllGetFunc {
// }
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
