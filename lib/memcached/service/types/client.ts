import {SaveCommandInfo} from './common';

// extends Omit<SaveCommandInfo, 'expireTimeInSeconds' | 'command'>

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
