import {GetCommandName, SaveCommandName, ErrorMessage, Flag, SaveStatus, SaveCommandProps} from './common';

/** Record stored on Server Side */
export interface RecordItem extends Pick<SaveCommandProps, 'bytes' | 'casId'> {
  flags: Flag;
  expiration: number;
  value: string;
}

export type SaveFunc = (key: string, item: RecordItem) => SaveStatus | ErrorMessage;
export type GetFunc = (keys: string[]) => {[key: string]: RecordItem};
export type AllSaveFunc = {
  [key in SaveCommandName]: SaveFunc;
};
export type AllGetFunc = {
  [key in GetCommandName]: GetFunc;
};
/** Api for store */
export interface StoreApi extends AllSaveFunc, AllGetFunc {}
