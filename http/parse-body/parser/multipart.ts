import fs from 'fs';
import {IncomingHttpHeaders} from 'http';
import {Transform, Writable} from 'stream';
import FormidableError, {internalCode} from '../service/error';
import EventEmitter from 'events';
import {Hash, createHash} from 'crypto';
import {toBuffer} from '../service/external';
import path from 'path';
import {getFileName} from '../service/utils';
import {FileInfo, GetParserFunc, ParsedItem, ParserOptions} from '../service/types';

let s = 0;
enum State {
  // PARSER_UNINITIALIZED = s++,
  START = s++,
  START_BOUNDARY = s++,
  HEADER_FIELD_START = s++,
  HEADER_FIELD = s++,
  HEADER_VALUE_START = s++,
  HEADER_VALUE = s++,
  HEADER_VALUE_ALMOST_DONE = s++,
  HEADERS_ALMOST_DONE = s++,
  PART_DATA_START = s++,
  PART_DATA = s++,
  PART_END = s++,
  END = s++,
}

let f = 1;
const FBOUNDARY = {PART_BOUNDARY: f, LAST_BOUNDARY: (f *= 2)};

const LF = 10;
const CR = 13;
const SPACE = 32;
const HYPHEN = 45;
const COLON = 58;
const A = 97;
const Z = 122;

function lower(c) {
  return c | 0x20;
}

type EventName =
  | 'partBegin'
  | 'headerField'
  | 'headerValue'
  | 'headerEnd'
  | 'headersEnd'
  | 'partData'
  | 'partEnd'
  | 'end';

class MultipartParser extends Transform {
  boundary: Buffer;
  boundaryChars: {
    [char: string]: true;
  };
  lookbehind: Buffer;
  bufferLength: number;
  state: State;
  index: number;
  flags: number;

  constructor(options: {boundaryStr: string}) {
    super({readableObjectMode: true});
    const {boundaryStr} = options;
    this.boundary = Buffer.from(`\r\n--${boundaryStr}`);
    for (let i = 0; i < this.boundary.length; i++) {
      this.boundaryChars[this.boundary[i]] = true;
    }
    this.lookbehind = Buffer.alloc(this.boundary.length + 8);
    this.bufferLength = 0;
    this.index = 0;
    this.flags = 0;
    this.state = State.START;
    this.boundaryChars = {};
  }

  _endUnexpected() {
    return new FormidableError(
      `MultipartParser.end(): stream ended unexpectedly: ${this.explain()}`,
      internalCode.malformedMultipart,
      400
    );
  }

  _flush(done) {
    if (
      (this.state === State.HEADER_FIELD_START && this.index === 0) ||
      (this.state === State.PART_DATA && this.index === this.boundary.length)
    ) {
      this._handleCallback('partEnd');
      this._handleCallback('end');
      done();
    } else if (this.state !== State.END) {
      done(this._endUnexpected());
    } else {
      done();
    }
  }

  _handleCallback(name: EventName, buf?: Buffer, start?: number, end?: number) {
    if (start !== undefined && start === end) {
      return;
    }
    this.push({name, buffer: buf, start, end});
  }

  _transform(buffer, _, done) {
    let i = 0;
    let prevIndex = this.index;
    let {index, state, flags} = this;
    const {lookbehind, boundary, boundaryChars} = this;
    const boundaryLength = boundary.length;
    const boundaryEnd = boundaryLength - 1;
    this.bufferLength = buffer.length;
    let c = null;
    let cl = null;

    const setMark = (name: EventName, idx?: number) => {
      this[`${name}Mark`] = typeof idx === 'number' ? idx : i;
    };

    const clearMarkSymbol = name => {
      delete this[`${name}Mark`];
    };

    const dataCallback = (name: EventName, shouldClear?: boolean) => {
      const markSymbol = `${name}Mark`;
      if (!(markSymbol in this)) {
        return;
      }

      if (!shouldClear) {
        this._handleCallback(name, buffer, this[markSymbol], buffer.length);
        setMark(name, 0);
      } else {
        this._handleCallback(name, buffer, this[markSymbol], i);
        clearMarkSymbol(name);
      }
    };

    for (i = 0; i < this.bufferLength; i++) {
      c = buffer[i];
      switch (state) {
        case State.START:
          index = 0;
          state = State.START_BOUNDARY;
        case State.START_BOUNDARY:
          if (index === boundary.length - 2) {
            if (c === HYPHEN) {
              flags |= FBOUNDARY.LAST_BOUNDARY;
            } else if (c !== CR) {
              done(this._endUnexpected());
              return;
            }
            index++;
            break;
          } else if (index - 1 === boundary.length - 2) {
            if (flags & FBOUNDARY.LAST_BOUNDARY && c === HYPHEN) {
              this._handleCallback('end');
              state = State.END;
              flags = 0;
            } else if (!(flags & FBOUNDARY.LAST_BOUNDARY) && c === LF) {
              index = 0;
              this._handleCallback('partBegin');
              state = State.HEADER_FIELD_START;
            } else {
              done(this._endUnexpected());
              return;
            }
            break;
          }

          if (c !== boundary[index + 2]) {
            index = -2;
          }
          if (c === boundary[index + 2]) {
            index++;
          }
          break;
        case State.HEADER_FIELD_START:
          state = State.HEADER_FIELD;
          setMark('headerField');
          index = 0;
        case State.HEADER_FIELD:
          if (c === CR) {
            clearMarkSymbol('headerField');
            state = State.HEADERS_ALMOST_DONE;
            break;
          }

          index++;
          if (c === HYPHEN) {
            break;
          }

          if (c === COLON) {
            if (index === 1) {
              // empty header field
              done(this._endUnexpected());
              return;
            }
            dataCallback('headerField', true);
            state = State.HEADER_VALUE_START;
            break;
          }

          cl = lower(c);
          if (cl < A || cl > Z) {
            done(this._endUnexpected());
            return;
          }
          break;
        case State.HEADER_VALUE_START:
          if (c === SPACE) {
            break;
          }

          setMark('headerValue');
          state = State.HEADER_VALUE;
        case State.HEADER_VALUE:
          if (c === CR) {
            dataCallback('headerValue', true);
            this._handleCallback('headerEnd');
            state = State.HEADER_VALUE_ALMOST_DONE;
          }
          break;
        case State.HEADER_VALUE_ALMOST_DONE:
          if (c !== LF) {
            done(this._endUnexpected());
            return;
          }
          state = State.HEADER_FIELD_START;
          break;
        case State.HEADERS_ALMOST_DONE:
          if (c !== LF) {
            done(this._endUnexpected());
            return;
          }

          this._handleCallback('headersEnd');
          state = State.PART_DATA_START;
          break;
        case State.PART_DATA_START:
          state = State.PART_DATA;
          setMark('partData');
        case State.PART_DATA:
          prevIndex = index;

          if (index === 0) {
            // boyer-moore derived algorithm to safely skip non-boundary data
            i += boundaryEnd;
            while (i < this.bufferLength && !(buffer[i] in boundaryChars)) {
              i += boundaryLength;
            }
            i -= boundaryEnd;
            c = buffer[i];
          }

          if (index < boundary.length) {
            if (boundary[index] === c) {
              if (index === 0) {
                dataCallback('partData', true);
              }
              index++;
            } else {
              index = 0;
            }
          } else if (index === boundary.length) {
            index++;
            if (c === CR) {
              // CR = part boundary
              flags |= FBOUNDARY.PART_BOUNDARY;
            } else if (c === HYPHEN) {
              // HYPHEN = end boundary
              flags |= FBOUNDARY.LAST_BOUNDARY;
            } else {
              index = 0;
            }
          } else if (index - 1 === boundary.length) {
            if (flags & FBOUNDARY.PART_BOUNDARY) {
              index = 0;
              if (c === LF) {
                // unset the PART_BOUNDARY flag
                flags &= ~FBOUNDARY.PART_BOUNDARY;
                this._handleCallback('partEnd');
                this._handleCallback('partBegin');
                state = State.HEADER_FIELD_START;
                break;
              }
            } else if (flags & FBOUNDARY.LAST_BOUNDARY) {
              if (c === HYPHEN) {
                this._handleCallback('partEnd');
                this._handleCallback('end');
                state = State.END;
                flags = 0;
              } else {
                index = 0;
              }
            } else {
              index = 0;
            }
          }

          if (index > 0) {
            // when matching a possible boundary, keep a lookbehind reference
            // in case it turns out to be a false lead
            lookbehind[index - 1] = c;
          } else if (prevIndex > 0) {
            // if our boundary turned out to be rubbish, the captured lookbehind
            // belongs to partData
            this._handleCallback('partData', lookbehind, 0, prevIndex);
            prevIndex = 0;
            setMark('partData');

            // reconsider the current character even so it interrupted the sequence
            // it could be the beginning of a new sequence
            i--;
          }

          break;
        case State.END:
          break;
        default:
          done(this._endUnexpected());
          return;
      }
    }

    dataCallback('headerField');
    dataCallback('headerValue');
    dataCallback('partData');

    this.index = index;
    this.state = state;
    this.flags = flags;

    done();
    return this.bufferLength;
  }

  explain() {
    return `state = ${State[this.state]}`;
  }
}

interface Meta {
  name?: string;
  filename?: string;
  contentType?: string;
  contentTransferEncoding?: string;
}

type FileRelatedParserOptions = Pick<
  ParserOptions,
  'encoding' | 'uploadDir' | 'wayOfHandleFile' | 'hashAlgorithm' | 'hashEncoding'
>;

class Part {
  options: Required<FileRelatedParserOptions>;
  meta: Meta;
  file: FileInfo;
  hash: Hash;
  buffer: Buffer = Buffer.alloc(0);
  constructor(options: FileRelatedParserOptions) {
    const {
      encoding = 'utf-8',
      uploadDir,
      wayOfHandleFile = 'save',
      hashAlgorithm = 'sha1',
      hashEncoding = 'base64',
    } = options;
    this.options = {encoding, uploadDir, wayOfHandleFile, hashAlgorithm, hashEncoding};
    this.meta = {};
    this.file = {};
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
  updateMeta(key: string, value: string) {
    if (!this.meta) {
      this.meta = {};
    }
    this.meta[key] = value;
  }
  getMetaValue(key: keyof Meta) {
    return this.meta[key];
  }
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
  end(chunk?: Buffer) {
    let resolve: (info: ParsedItem) => void;
    let reject: (err: Error) => void;
    this.buffer = toBuffer([this.buffer, chunk]);
    const filename = this.getMetaValue('filename');
    const name = this.getMetaValue('name');
    const key = name ?? filename ?? '';
    if (this.type === 'file') {
      this.checkHash();
      chunk && this.hash.update(chunk);
      const hashValue = this.hash.digest(this.options.hashEncoding);
      const fileValueInfo: Pick<FileInfo, 'encoding' | 'value'> = {};
      if (this.needCacheFile) {
        const encoding = 'base64';
        fileValueInfo.encoding = encoding;
        fileValueInfo.value = this.buffer.toString(encoding);
      }
      if (this.needSaveFile) {
        const id = hashValue.substring(0, 12);
        const originName = filename ?? name ?? '';
        const finalName = id + '.' + originName;
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
          resolve({[key]: this.file});
        });
      } else {
        resolve({
          [key]: {
            name: filename,
            byteLength: this.buffer.byteLength,
            ...fileValueInfo,
          },
        });
      }
      if (!this.needCacheFile) {
        this.buffer = Buffer.alloc(0);
      }
    } else {
      resolve({
        [key]: this.buffer,
      });
    }
    return new Promise<ParsedItem>((res, rej) => {
      resolve = res;
      reject = rej;
    });
  }
  revert() {}
}

function getTransformForParser(parseOptions: ParserOptions) {
  const {encoding = 'utf-8'} = parseOptions;
  let headerField: string;
  let headerValue: string;
  let part: Part;
  const transformParserData = new Transform({
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
            cb(new FormidableError('unknown transfer-encoding', internalCode.unknownTransferEncoding, 501));
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

export const getMultpartParser: GetParserFunc = (headers: IncomingHttpHeaders, parseOptions: ParserOptions) => {
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
}
