import {Writable} from 'stream';
import {ParsedItem, ParsedResult, ParsedValue, ParserOptions} from './types';

export const defaultParseOptions: Required<ParserOptions> = {
  // maxPayloadSizeinKb?: number;
  // maxFileSizeinKb?: number;
  uploadDir: '',
  encoding: 'utf-8',
  wayOfHandleFile: 'save',
  hashAlgorithm: 'sha1',
  // hashEncoding: 'base64url',
  hashEncoding: 'hex',
};

/**
 * NOTICE:
 * Should take care of special character for filename, such as /
 */
export function getFileName(headerValue: string) {
  // matches either a quoted-string or a token (RFC 2616 section 19.5.1)
  const m = headerValue.match(/\bfilename=("(.*?)"|([^()<>{}[\]@,;:"?=\s/\t]+))($|;\s)/i);
  if (!m) return null;

  const match = m[2] || m[3] || '';
  let originalFilename = match.substr(match.lastIndexOf('\\') + 1);
  originalFilename = originalFilename.replace(/%22/g, '"');
  originalFilename = originalFilename.replace(/&#([\d]{4});/g, (_, code) => String.fromCharCode(code));

  return originalFilename;
}

/**
 * Cache data on buffer and return them on finalize
 * @param parserOptions
 * @returns
 */
export function getCacheWriter(parserOptions: ParserOptions) {
  const {encoding = 'utf-8'} = parserOptions;
  const result: ParsedResult = {};
  const writer = new Writable({
    objectMode: true,
    write(item: ParsedItem, _enc, cb) {
      for (const [key, value] of Object.entries(item)) {
        let finalValue: ParsedValue = value;
        if (Buffer.isBuffer(value)) {
          finalValue = value.toString(encoding);
        }
        if (Object.prototype.hasOwnProperty.call(result, key) && !Array.isArray(result[key])) {
          result[key] = [result[key] as ParsedValue];
        }
        if (Array.isArray(result[key])) {
          (result[key] as Array<ParsedValue>).push(finalValue);
        } else {
          result[key] = finalValue;
        }
      }
      cb && cb();
    },
    final(cb) {
      cb && cb();
    },
  });
  const waitCacheData = new Promise<ParsedResult>((res, rej) => {
    writer.on('finish', () => {
      res(result);
    });
    writer.on('error', err => {
      rej(err);
    });
  });
  return {writer, waitCacheData};
}
