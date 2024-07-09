import fs from 'fs';
import path from 'path';
import {Hash, createHash} from 'crypto';
import {toBuffer} from '../service/external';
import {FileInfo, ParsedResult, ParserOptions} from '../service/types';

interface Meta {
  name?: string;
  filename?: string;
  contentType?: string;
  contentTransferEncoding?: string;
}

type FileRelatedParserOptions = Pick<
  Required<ParserOptions>,
  'uploadDir' | 'wayOfHandleFile' | 'hashAlgorithm' | 'hashEncoding'
>;

export class Part {
  options: Required<FileRelatedParserOptions>;
  meta: Meta;
  file: FileInfo;
  hash: Hash;
  buffer: Buffer = Buffer.alloc(0);
  constructor(options: FileRelatedParserOptions) {
    const {uploadDir, wayOfHandleFile, hashAlgorithm, hashEncoding} = options;
    this.options = {uploadDir, wayOfHandleFile, hashAlgorithm, hashEncoding};
    this.meta = {};
    this.file = {};
    this.updateMeta({'contentTransferEncoding': 'utf-8'});
  }
  get needSaveFile() {
    const {wayOfHandleFile} = this.options;
    return wayOfHandleFile === 'save' || wayOfHandleFile === 'cacheAndSave';
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
  updateFileInfo(info: FileInfo) {
    for (const [key, value] of Object.entries(info)) {
      this.file[key] = value;
    }
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
        [key]: this.buffer,
      };
    }
  }
}
