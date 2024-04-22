/** */
export type SaveCommandName =
  /** "set" means "store this data" */
  | 'set'
  /** "add" means "store this data, but only if the server *doesn't* already hold data for this key". */
  | 'add'
  /** "replace" means "store this data, but only if the server *does* already hold data for this key". */
  | 'replace'
  /** "append" means "add this data to an existing key after existing data" */
  | 'append'
  /** "prepend" means "add this data to an existing key before existing data". */
  | 'prepend'
  /** "cas" is a check and set operation which means "store this data but only if no one else has updated since I last fetched it." */
  | 'cas';

//<cmd> <key> <flags> <exptime> <bytes>
//<cmd> <key> <flags> <exptime> <bytes> <cas unique>
export interface SaveCommandInfo {
  command: SaveCommandName;
  key: string;
  flags: string;
  expireTimeInSeconds: number;
  bytes: number;
  casId?: string;
  value: Buffer;
}

export enum SaveResponseStatus {
  /** "STORED\r\n", to indicate success. */
  STORED = 'STORED',
  /**
   * "NOT_STORED\r\n" to indicate the data was not stored, but not because of an error.
   * This normally means that the condition for an "add" or a "replace" command wasn't met.
   */
  NOT_STORED = 'NOT_STORED',
  /** "EXISTS\r\n" to indicate that the item you are trying to store with a "cas" command has been modified since you last fetched it. */
  EXISTS = 'EXISTS',
  /** "NOT_FOUND\r\n" to indicate that the item you are trying to store with a "cas" command did not exist. */
  NOT_FOUND = 'NOT_FOUND',
}
// const error
export type ErrorMessage = `${ErrorStatus} ${string}`;

export type GetCommandName = 'gets' | 'get';
export interface GetCommandInfo {
  command: GetCommandName;
  keys: string[];
}

export interface DeleteCommandInfo {
  command: 'delete';
  key: string;
  noreply?: boolean;
}
export enum DeleteResponseStatus {
  DELETED = 'DELETED',
  NOT_FOUND = 'NOT_FOUND',
}

export type CommandName = SaveCommandName | GetCommandName;

export enum Flag {
  unknown = '-1',
  string = '0',
  json = '' + (1 << 1),
  binary = '' + (1 << 2),
  number = '' + (1 << 3),
}

export enum ErrorStatus {
  Error = 'Error',
  CLIENT_ERROR = 'CLIENT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}
