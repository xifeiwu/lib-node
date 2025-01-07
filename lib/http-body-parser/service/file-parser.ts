import fs from 'fs';
import path from 'path';
import {Hash, createHash} from 'crypto';
import {toBuffer} from './external';
import {ParsedFileInfo, ParsedResult, ParserOptions} from './types';

interface Meta {
  name?: string;
  filename?: string;
  /** if contentType is not undefine, then the type is file, or is field */
  contentType?: string;
  contentTransferEncoding?: string;
}

type FileRelatedParserOptions = Pick<Required<ParserOptions>, 'uploadDir' | 'wayOfHandleFile' | 'hash'>;

/**
 * Parser for Binary data. such as Form Part or data with content-type of octet-stream
 * Emit an object, name as key, a ParsedFileInfo as value
 */
export class FileParser {
  options: Required<FileRelatedParserOptions>;
  /** meta for thie Parser */
  meta: Meta;
  file: ParsedFileInfo;
  hash: Hash;
  buffer: Buffer = Buffer.alloc(0);
  constructor(options: FileRelatedParserOptions) {
    const {uploadDir, wayOfHandleFile, hash} = options;
    this.options = {uploadDir, wayOfHandleFile, hash};
    this.meta = {};
    this.file = {};
    this.updateMeta({contentTransferEncoding: 'utf-8'});
  }
  /** Not support save file when uploadDir not set */
  get needSaveFile() {
    const {uploadDir, wayOfHandleFile} = this.options;
    return uploadDir && (wayOfHandleFile === 'save' || wayOfHandleFile === 'cacheAndSave');
  }
  get needCacheFile() {
    const {wayOfHandleFile} = this.options;
    return wayOfHandleFile === 'cache' || wayOfHandleFile === 'cacheAndSave';
  }
  /** Type is file when field of contentType exist in meta part */
  get type() {
    return this.meta.contentType === undefined ? 'field' : 'file';
  }
  updateMeta(info: Meta) {
    if (!this.meta) {
      this.meta = {};
    }
    for (const [key, value] of Object.entries(info)) {
      this.meta[key] = value;
    }
  }
  getMetaValue(key: keyof Meta) {
    return this.meta[key];
  }
  /** Update partial or full info fo this.file */
  updateFileInfo(info: ParsedFileInfo) {
    for (const [key, value] of Object.entries(info)) {
      this.file[key] = value;
    }
  }
  /** Create hash object if not exist */
  checkHash() {
    if (!this.hash) {
      this.hash = createHash(this.options.hash.algorithm);
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
      const hashValue = this.hash.digest(this.options.hash.encoding);
      this.updateFileInfo({
        byteLength: this.buffer.byteLength,
        wayOfHandleFile: this.options.wayOfHandleFile,
        hashValue,
      });
      if (this.needCacheFile) {
        this.updateFileInfo({
          value: this.buffer,
        });
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
            this.updateFileInfo({
              name: finalName,
              id,
            });
            resolve();
          });
        });
      } else {
        this.updateFileInfo({
          name: filename,
        });
      }
      result[key] = this.file;
      if (!this.needCacheFile) {
        this.buffer = Buffer.alloc(0);
      }
      return result;
    } else {
      return {
        [key]: this.buffer.toString(this.getMetaValue('contentTransferEncoding') as BufferEncoding),
      };
    }
  }
}
