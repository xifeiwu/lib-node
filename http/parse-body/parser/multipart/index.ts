import fs from 'fs';
import {IncomingHttpHeaders} from 'http';
import {Transform} from 'stream';
import FormidableError, {internalCode} from '../../service/error';
import {Hash, createHash} from 'crypto';
import {toBuffer} from '../../service/external';
import path from 'path';
import {defaultParseOptions, getFileName} from '../../service/utils';
import {
  FileInfo,
  FileValue,
  GetParserFunc,
  ParsedItem,
  ParsedResult,
  ParserOptions,
} from '../../service/types';
import {MultipartParser} from './parser';

interface Meta {
  name?: string;
  filename?: string;
  contentType?: string;
  contentTransferEncoding?: string;
}

type FileRelatedParserOptions = Pick<
  ParserOptions,
  'uploadDir' | 'wayOfHandleFile' | 'hashAlgorithm' | 'hashEncoding'
>;

class Part {
  options: Required<FileRelatedParserOptions>;
  meta: Meta;
  file: FileInfo;
  hash: Hash;
  buffer: Buffer = Buffer.alloc(0);
  constructor(options: FileRelatedParserOptions) {
    const {uploadDir, wayOfHandleFile, hashAlgorithm, hashEncoding} = {
      ...defaultParseOptions,
      ...options,
    };
    this.options = {uploadDir, wayOfHandleFile, hashAlgorithm, hashEncoding};
    this.meta = {};
    this.file = {};
    this.updateMeta('contentTransferEncoding', 'utf-8');
  }
  get needSaveFile() {
    const {wayOfHandleFile} = this.options;
    return wayOfHandleFile === 'save' || wayOfHandleFile === 'cacheAndSave';
  }
  get needCacheFile() {
    const {wayOfHandleFile} = this.options;
    return wayOfHandleFile === 'cache' || wayOfHandleFile === 'cacheAndSave';
  }
  get type() {
    return this.meta.contentType === undefined ? 'field' : 'file';
  }
  updateMeta(key: keyof Meta | string, value: string) {
    if (!this.meta) {
      this.meta = {};
    }
    this.meta[key] = value;
  }
  getMetaValue(key: keyof Meta) {
    return this.meta[key];
  }
  /** Create hash object if not exist */
  checkHash() {
    if (!this.hash) {
      this.hash = createHash(this.options.hashAlgorithm);
    }
  }
  write(chunk: Buffer) {
    this.buffer = toBuffer([this.buffer, chunk]);
    if (this.type === 'file') {
      this.checkHash();
      this.hash.update(chunk);
    }
  }
  async end(chunk?: Buffer) {
    this.buffer = toBuffer([this.buffer, chunk]);
    const filename = this.getMetaValue('filename');
    const name = this.getMetaValue('name');
    const key = name ?? filename ?? '';
    if (this.type === 'file') {
      const result: ParsedResult = {};
      this.checkHash();
      chunk && this.hash.update(chunk);
      const hashValue = this.hash.digest(this.options.hashEncoding);
      const fileValueInfo: FileValue = {};
      if (this.needCacheFile) {
        // const encoding = 'base64';
        // fileValueInfo.encoding = encoding;
        // fileValueInfo.value = this.buffer.toString(encoding);
        fileValueInfo.value = this.buffer;
      }
      if (this.needSaveFile) {
        const id = hashValue.substring(0, 12);
        const originName = filename ?? name ?? '';
        const finalName = id + '.' + originName;
        await new Promise<void>((resolve, reject) => {
          fs.writeFile(path.resolve(this.options.uploadDir, finalName), this.buffer, null, err => {
            if (err) {
              reject(err);
            }
            this.file = {
              name: finalName,
              byteLength: this.buffer.byteLength,
              wayOfHandleFile: this.options.wayOfHandleFile,
              hashValue,
              id,
              ...fileValueInfo,
            };
            resolve();
          });
        });
        result[key] = this.file;
      } else {
        result[key] = {
          name: filename,
          byteLength: this.buffer.byteLength,
          ...fileValueInfo,
        };
      }
      if (!this.needCacheFile) {
        this.buffer = Buffer.alloc(0);
      }
      return result;
    } else {
      return {
        [key]: this.buffer,
      };
    }
  }
  revert() {}
}

function getTransformForParser(parseOptions: ParserOptions) {
  const {encoding = 'utf-8'} = parseOptions;
  let headerField: string;
  let headerValue: string;
  let part: Part;
  const transformParserData = new Transform({
    objectMode: true,
    async transform({name, buffer, start, end}, _enc, cb) {
      if (name === 'partBegin') {
        part = new Part(parseOptions);
        headerField = '';
        headerValue = '';
      } else if (name === 'headerField') {
        headerField += buffer.toString(encoding, start, end);
      } else if (name === 'headerValue') {
        headerValue += buffer.toString(encoding, start, end);
      } else if (name === 'headerEnd') {
        headerField = headerField.toLowerCase();
        part.updateMeta(headerField, headerValue);

        // matches either a quoted-string or a token (RFC 2616 section 19.5.1)
        const m = headerValue.match(
          // eslint-disable-next-line no-useless-escape
          /\bname=("([^"]*)"|([^\(\)<>@,;:\\"\/\[\]\?=\{\}\s\t/]+))/i
        );
        if (headerField === 'content-disposition') {
          if (m) {
            part.updateMeta('name', m[2] || m[3] || '');
          }

          part.updateMeta('filename', getFileName(headerValue));
        } else if (headerField === 'content-type') {
          part.updateMeta('contentType', headerValue);
        } else if (headerField === 'content-transfer-encoding') {
          part.updateMeta('contentTransferEncoding', headerValue.toLowerCase());
        }

        headerField = '';
        headerValue = '';
      } else if (name === 'headersEnd') {
      } else if (name === 'partData') {
        switch (part.getMetaValue('contentTransferEncoding')) {
          case 'binary':
          case '7bit':
          case '8bit':
          case 'utf-8': {
            part.write(buffer.slice(start, end));
            break;
          }
          case 'base64': {
            part.write(Buffer.from(buffer.slice(start, end).toString('ascii')));
            break;
          }
          default:
            return cb(
              new FormidableError('unknown transfer-encoding', internalCode.unknownTransferEncoding, 501)
            );
        }
      } else if (name === 'partEnd') {
        this.push(await part.end());
      } else if (name === 'end') {
        this.push(null);
      }
      cb();
    },
  });
  return transformParserData;
}

export const getMultpartParser: GetParserFunc = (
  headers: IncomingHttpHeaders,
  parseOptions: ParserOptions
) => {
  /** content-type:multipart/form-data; boundary=----WebKitFormBoundaryE7DpP5ncpQWn8RRu */
  const {'content-type': contentType} = headers;
  const multipart = /multipart/i.test(contentType);
  if (!multipart) {
    return;
  }
  const execResult = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!execResult) {
    throw new FormidableError(
      'bad content-type header, no multipart boundary',
      internalCode.missingMultipartBoundary,
      400
    );
  }
  const boundaryStr = execResult[1] || execResult[2];

  return [new MultipartParser({boundaryStr}), getTransformForParser(parseOptions)];
};
