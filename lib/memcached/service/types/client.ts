import net from 'net';
import {CanConvertToBuffer} from '../external';
import {
  GetCommandName,
  SaveCommandName,
  ErrorMessage,
  SaveResponseStatus,
  SaveCommandInfo,
  Flag,
  DeleteCommandInfo,
} from './common';

// VALUE <key> <flags> <bytes> [<cas unique>]\r\n
// <data block>\r\n
// END\r\n
export interface GetResponseInfo {
  command: 'VALUE' | 'END';
  key: string;
  flags: Flag;
  bytes: number;
  casId?: string;
  value?: Buffer;
}

export interface ClientSaveCommandInfo extends Pick<SaveCommandInfo, 'key' | 'casId'> {
  flags?: SaveCommandInfo['flags'];
  expireTimeInSeconds?: SaveCommandInfo['expireTimeInSeconds'];
  value: CanConvertToBuffer;
}

type SaveFunc = (item: ClientSaveCommandInfo) => Promise<SaveResponseStatus | ErrorMessage>;
type GetFunc = (keys: string[]) => Promise<GetResponseInfo[]>;
type AllSaveFunc = {
  [key in SaveCommandName]: SaveFunc;
};
type AllGetFunc = {
  gets: <T = any>(keys: string[]) => Promise<{[key: string]: T}>;
  get: <T = any>(key) => Promise<T>;
};
type DeleteFunc = {
  delete: (key: DeleteCommandInfo['key'], noreply?: DeleteCommandInfo['noreply']) => Promise<Error | true>;
};
/** Api for store */
export interface ClientApi extends AllSaveFunc, AllGetFunc, DeleteFunc {}

interface HandleStatus {
  remainingBuffer?: Buffer;
  done?: boolean;
}

export type DataHandler = (
  chunk: Buffer,
  socket?: net.Socket
  // cb: (err, data: any) => void
) => HandleStatus | Promise<HandleStatus>;
export interface ConnectionInfo {
  socket: net.Socket;
  cachedBuffer?: Buffer;
  dataHandlerQueue?: Array<DataHandler>;
}
