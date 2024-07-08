import {BinaryToTextEncoding} from 'crypto';
import {IncomingHttpHeaders} from 'http';
import {Transform} from 'stream';

export type GetParserFunc = (headers: IncomingHttpHeaders, parseOptions: ParserOptions) => Array<Transform>;

/**
 * save means save data to uploadDir directly after end of file, and release the buffer after save success.
 * cache means save data to value of FileInfo, then the data can be accessed and used in the following logic.
 */
type WayOfHandleFile = 'cache' | 'save' | 'cacheAndSave';

export interface ParserOptions {
  maxPayloadSizeinKb?: number;
  maxFileSizeinKb?: number;
  encoding?: BufferEncoding;
  uploadDir: string;
  wayOfHandleFile?: WayOfHandleFile;
  hashAlgorithm?: string;
  hashEncoding?: BinaryToTextEncoding;
}

export interface FileValue {
  encoding?: BufferEncoding;
  value?: Buffer;
}
export interface FileInfo extends FileValue {
  name?: string;
  byteLength?: number;
  wayOfHandleFile?: ParserOptions['wayOfHandleFile'];
  id?: string;
  hashValue?: string;
}

export type ParsedValue = Buffer | string | FileInfo;
export interface ParsedItem {
  [key: string]: ParsedValue;
}
export interface ParsedResult {
  [key: string]: ParsedValue | Array<ParsedValue>;
}
