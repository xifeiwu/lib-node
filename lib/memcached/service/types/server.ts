import {GetCommandName, SaveCommandName, ErrorMessage, SaveResponseStatus, SaveCommandInfo} from './common';

/** Record stored on Server Side */
export interface RecordItem extends Pick<SaveCommandInfo, 'bytes' | 'casId' | 'value'> {
  flags: string;
  expiration: number;
}

export type SaveFunc = (key: string, item: RecordItem) => SaveResponseStatus | ErrorMessage;
export type GetFunc = (keys: string[]) => {[key: string]: RecordItem};
export type AllSaveFunc = {
  [key in SaveCommandName]: SaveFunc;
};
export type AllGetFunc = {
  [key in GetCommandName]: GetFunc;
};
/** Api for store */
export interface StoreApi extends AllSaveFunc, AllGetFunc {}
