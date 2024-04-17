// VALUE <key> <flags> <bytes> [<cas unique>]\r\n
// <data block>\r\n
// END\r\n
export interface GetResponseInfo {
  command: 'VALUE' | 'END';
  key: string;
  flags: string;
  bytes: number;
  casId?: string;
  value?: Buffer;
}

import {GetCommandName, SaveCommandName, ErrorMessage, Flag, SaveStatus, SaveCommandProps} from './common';

/** Record stored on Server Side */
export interface ClientSaveCommandInfo extends Pick<SaveCommandProps, 'key' | 'bytes' | 'casId' | 'expireTimeInSeconds'> {
  // flags: Flag;
  // expiration: number;
  value: Buffer;
}

export type SaveFunc = (item: ClientSaveCommandInfo) => SaveStatus | ErrorMessage;
export type GetFunc = (keys: string[]) => {[key: string]: ClientSaveCommandInfo};
export type AllSaveFunc = {
  [key in SaveCommandName]: SaveFunc;
};
export type AllGetFunc = {
  [key in GetCommandName]: GetFunc;
};
/** Api for store */
export interface ClientApi extends AllSaveFunc, AllGetFunc {}
