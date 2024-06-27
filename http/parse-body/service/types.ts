import {BinaryToTextEncoding} from 'crypto';
import {IncomingHttpHeaders} from 'http';
import {Transform} from 'stream';

export type GetParserFunc = (headers: IncomingHttpHeaders, parseOptions: ParserOptions) => Array<Transform>;

type WayOfHandleFile = 'cache' | 'save' | 'cacheAndSave';
export interface ParserOptions {
  maxPayloadSizeinKb?: number;
  maxFileSizeinKb?: number;
  encoding?: BufferEncoding;
  uploadDir: string;
  wayOfHandleFile?: WayOfHandleFile; // | ((data: Buffer) => WayOfHandleFile);
  hashAlgorithm?: string;
  hashEncoding?: BinaryToTextEncoding;
}

export interface FileValue {
  encoding?: BufferEncoding;
  value?: string;
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
