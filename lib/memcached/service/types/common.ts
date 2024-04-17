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

/**
 * Used in Handle process
 */
export interface SaveCommandProps {
  key: string;
  flags: string;
  expireTimeInSeconds: number;
  bytes: number;
  casId?: string;
}

/** All props of save command */
export interface SaveCommandInfo extends SaveCommandProps {
  command: SaveCommandName;
  value: Buffer;
}

export enum SaveStatus {
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

export enum ErrorStatus {
  Error = 'Error',
  CLIENT_ERROR = 'CLIENT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
}

export type GetCommandName = 'get';
export interface GetCommandInfo {
  command: GetCommandName;
  keys: string[];
}

export type CommandName = SaveCommandName | GetCommandName;

export type RetrieveAction = '';
export enum Flag {
  json = 1 << 1,
  binary = 1 << 2,
  numeric = 1 << 3,
}

// export type CommandInfo<CommandName extends SaveCommandName | GetCommand, T> = {
//   command: CommandName;
//   /** Only Command4Store have value after command line */
//   value?: Buffer;
// } & T;
