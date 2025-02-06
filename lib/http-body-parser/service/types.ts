import {BinaryToTextEncoding} from 'crypto';
import {IncomingHttpHeaders} from 'http';
import {Transform} from 'stream';

export type GetParserFunc = (
  headers: IncomingHttpHeaders,
  parseOptions: Required<HttpBodyParserOptions>
) => Array<Transform>;

/**
 * save means save data to uploadDir directly after end of file, and release the buffer after save success.
 * cache means save data to value of FileInfo, then the data can be accessed and used in the following logic.
 */
type WayOfHandleFile = 'cache' | 'save' | 'cacheAndSave';

export interface HttpBodyParserOptions {
  // maxPayloadSizeinKb?: number;
  // maxFileSizeinKb?: number;
  /** encoding of incoming data */
  encoding?: BufferEncoding;
  uploadDir?: string;
  wayOfHandleFile?: WayOfHandleFile;
  hash?: {
    algorithm?: string;
    encoding?: BinaryToTextEncoding;
  };
  /**
   * headers set in this part will override headers of IncomingMessage
   */
  headers?: IncomingHttpHeaders;
}

export interface ParsedFileInfo {
  name?: string;
  byteLength?: number;
  wayOfHandleFile?: HttpBodyParserOptions['wayOfHandleFile'];
  /** Use hash value as id of as file to avoid duplicate filename, and identify whether file exist */
  id?: string;
  hashValue?: string;
  encoding?: BufferEncoding;
  value?: Buffer;
}

export type ParsedValue = Buffer | string | ParsedFileInfo;
/**
 * For Content-Type
 * json, ParsedValue is string, or object,
 * multipart, ParsedValue is Buffer
 * octet, ParseValue is Buffer
 */
export interface ParsedItem {
  [key: string]: ParsedValue;
}
export interface ParsedResult {
  [key: string]: ParsedValue | Array<ParsedValue>;
}
