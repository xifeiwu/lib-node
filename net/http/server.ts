import {Socket} from 'net';
import {Readable} from 'stream';
import {HttpHeaderPartProps, HttpFirstLineProps} from '../../types';
import {httpFirstLineReg, httpHeaderLineReg} from '../../constants';
import {getDataFromReadable, getOneLineFromBuffer, getOneLineFromReader} from '../../stream';
import {isNumber} from '../../external';
import {startSocketServer} from '../utils';
import {responseInfoToBuffer} from '../../http';

interface ParseFirstLineResults {
  firstLineInfo?: HttpFirstLineProps;
  dataConsumed: Buffer;
}
export async function tryParseHttpFirstLine(reader: Readable): Promise<ParseFirstLineResults | null> {
  const buffer = await getOneLineFromReader(reader);
  const line = buffer.toString('utf-8').trim().replace(/\r\n$/, '');
  const execResult = httpFirstLineReg.exec(line);
  let firstLineInfo: HttpFirstLineProps;
  if (execResult) {
    const [method, url, httpVersion] = execResult.slice(1);
    firstLineInfo = {method, url, httpVersion};
  }
  return {firstLineInfo, dataConsumed: buffer};
}

interface ParseHttpHeaderResults {
  headerPartProps?: HttpHeaderPartProps<'Server'>;
  dataConsumed: Buffer;
}
export async function tryParseHttpHeaderPart<T extends Readable>(
  reader: T,
  firstLineInfo?: HttpFirstLineProps
): Promise<ParseHttpHeaderResults> {
  let headerPartProps: HttpHeaderPartProps<'Server'>;
  // let resolve: (v: ParseHttpHeaderResults) => void;
  // let reject: (err: Error) => void;
  let dataConsumed: Buffer = Buffer.alloc(0);
  if (!firstLineInfo) {
    const parseResult = await tryParseHttpFirstLine(reader);
    if (!parseResult.firstLineInfo) {
      // throw new Error(`Parse http first line fail`);
      return {
        dataConsumed: parseResult.dataConsumed,
      };
    }
    headerPartProps = {...parseResult.firstLineInfo};
    dataConsumed = Buffer.concat([dataConsumed, parseResult.dataConsumed]);
  } else {
    headerPartProps = {...firstLineInfo};
  }
  let lineBuffer: Buffer;
  while ((lineBuffer = await getOneLineFromReader(reader))) {
    dataConsumed = Buffer.concat([dataConsumed, lineBuffer]);
    const line = lineBuffer.toString('utf-8').trim().replace(/\r\n$/, '');
    if (line === '') {
      break;
    }
    const execResult = httpHeaderLineReg.exec(line);
    if (!execResult) {
      throw new Error(`Format error for http header: ${line}`);
    }
    if (!headerPartProps['headers']) {
      headerPartProps['headers'] = {};
    }
    const {headers} = headerPartProps;
    const [part1, part2] = execResult.slice(1);
    const field = part1.toLowerCase();
    const value: string = part2;
    // if (['content-length'].includes(field)) {
    //   value = parseInt(part2);
    // }
    if (!Object.prototype.hasOwnProperty.call(headers, field)) {
      headers[field] = value;
    } else {
      if (!Array.isArray(headers[field])) {
        headers[field] = [headers[field]];
      }
      (headers[field] as string[]).push(value);
    }
  }
  return {headerPartProps, dataConsumed};
}

export class HttpIncomingMessage extends Readable {
  socket: Socket;
  headerPartProps: HttpHeaderPartProps<'Server'>;
  receivedDataLength: number;
  handleDataByContentLength: (chunk: Buffer) => void;
  handleChunkedData: (chunk: Buffer) => void;
  constructor(socket: Socket) {
    super();
    this.receivedDataLength = 0;
    this.socket = socket;
    /** Should care of this refer for event callback function */
    this.handleDataByContentLength = this._handleDataByContentLength.bind(this);
    this.handleChunkedData = this._handleChunkedData.bind(this);
  }
  /** Should take care of parse sequence */
  async parse() {
    await this.parseHeaderPart();
    this.parseRemainingData();
  }
  _read() {}
  get headers() {
    const {headers = {}} = this.headerPartProps ?? {};
    return headers;
  }
  get contentLength() {
    const contentLength = parseInt(this.headers['content-length']);
    if (isNumber(contentLength)) {
      return contentLength;
    }
  }
  get chunkedTransfer() {
    const transferEncoding = this.headers['transfer-encoding'];
    return transferEncoding === 'chunked';
  }
  _handleDataByContentLength(chunk: Buffer) {
    const {closed, contentLength} = this;
    if (closed) {
      this.socket.off('data', this.handleDataByContentLength);
      return;
    }
    let end = false;
    this.receivedDataLength += chunk.byteLength;
    if (this.receivedDataLength <= contentLength) {
      this.push(chunk);
      if (this.receivedDataLength === contentLength) {
        this.push(null);
        end = true;
      }
    } else {
      this.push(chunk.subarray(0, this.receivedDataLength - contentLength));
      this.push(null);
      end = true;
      throw new Error(`receivedData should not be larger than contentLength`);
    }
    if (end) {
      this.socket.off('data', this.handleDataByContentLength);
    }
  }
  _handleChunkedData(chunk: Buffer) {
    const {consumed: consumedBuffer, success, remaining: remainingBuffer} = getOneLineFromBuffer(chunk);
    if (!success) {
      throw new Error(`Get line failure`);
    }
    const line = consumedBuffer.toString('utf-8').trim().replace(/\r\n$/, '');
    const size = parseInt(line);
    if (!isNumber(size)) {
      throw new Error(`first line is not a hex number`);
    }
    if (size === 0) {
      this.push(null);
      this.socket.off('data', this.handleChunkedData);
      return;
    }
    if (remainingBuffer.length < size) {
      throw new Error(`remainingBuffer.length < size`);
    }
    this.push(chunk.subarray(0, size));
  }
  async parseHeaderPart() {
    const {headerPartProps} = await tryParseHttpHeaderPart(this.socket);
    this.headerPartProps = headerPartProps;
  }
  parseRemainingData() {
    /** These getter value should accessed after parseHttpHeaderPart success  */
    const {socket, headerPartProps, contentLength, chunkedTransfer} = this;
    this.headerPartProps = headerPartProps;
    if (chunkedTransfer) {
      socket.on('data', this.handleChunkedData);
    } else if (isNumber(contentLength)) {
      if (contentLength === 0) {
        this.push(null);
      } else {
        socket.on('data', this.handleDataByContentLength);
      }
    } else {
      this.push(null);
    }
  }
}

/**
 *
 * @param socket
 * @param options
 * @returns HttpIncomingMessage after parse headerPart success
 */
export async function getHttpIncomingMessage(socket: Socket, options?: {}) {
  const incomingMessage = new HttpIncomingMessage(socket);
  await incomingMessage.parse();
  return incomingMessage;
}
