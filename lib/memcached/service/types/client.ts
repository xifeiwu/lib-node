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

import {CanConvertToBuffer} from '../external';
import {GetCommandName, SaveCommandName, ErrorMessage, SaveStatus, SaveCommandInfo} from './common';

/** Record stored on Server Side */
// export interface ClientSaveCommandInfo
//   extends Pick<SaveCommandProps, 'key' | 'bytes' | 'casId' | 'expireTimeInSeconds'> {
//   value: Buffer;
// }
export interface ClientSaveCommandInfo extends Omit<SaveCommandInfo, 'command' | 'bytes' | 'value'> {
  value: CanConvertToBuffer;
}

type SaveFunc = (item: ClientSaveCommandInfo) => Promise<SaveStatus | ErrorMessage>;
type GetFunc = (keys: string[]) => Promise<{[key: string]: ClientSaveCommandInfo}>;
type AllSaveFunc = {
  [key in SaveCommandName]: SaveFunc;
};
type AllGetFunc = {
  // [key in GetCommandName]: GetFunc;
};
/** Api for store */
export interface ClientApi extends AllSaveFunc, AllGetFunc {}
