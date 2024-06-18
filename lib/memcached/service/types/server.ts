import {
  GetCommandName,
  SaveCommandName,
  ErrorMessage,
  SaveResponseStatus,
  SaveCommandInfo,
  DeleteResponseStatus,
} from './common';

/** Record stored on Server Side */
export interface RecordItem extends Pick<SaveCommandInfo, 'bytes' | 'casId' | 'value'> {
  flags: string;
  expiration: number;
}

export type SaveFunc = (key: string, item: RecordItem) => SaveResponseStatus | ErrorMessage;
export type AllSaveFunc = {
  [key in SaveCommandName]: SaveFunc;
};

export type AllGetFunc = {
  gets: (keys: string[]) => {[key: string]: RecordItem};
  get: (keys: string) => RecordItem;
};

export type DeleteFunc = {delete: (key: string) => DeleteResponseStatus | ErrorMessage};

/** Api for store */
export interface StoreApi extends AllSaveFunc, AllGetFunc, DeleteFunc {
  toArray: () => [string, RecordItem][];
  toJSON: () => object;
}
