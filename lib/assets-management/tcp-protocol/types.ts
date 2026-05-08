import type {MetaDiffForSyncUp} from '../types';

export type AssetsSyncCommand = 'push' | 'pull' | 'diff';

export interface AddFileMessage {
  label: 'add-file';
  meta: {relativePath: string; size: number};
}

export interface DiffMessage {
  label: 'diff';
  meta: MetaDiffForSyncUp;
}

export interface SuccessMessage {
  label: 'success';
  meta: {git?: {committed: boolean; pushed: boolean}};
}

export interface InfoMessage {
  label: 'info';
  meta: {message: string};
}

export interface ErrorMessage {
  label: 'error';
  meta: {message: string};
}

export interface SimpleMessage {
  label: 'transfer-complete';
}

export type ChatMessage =
  | AddFileMessage
  | DiffMessage
  | SuccessMessage
  | InfoMessage
  | ErrorMessage
  | SimpleMessage;
