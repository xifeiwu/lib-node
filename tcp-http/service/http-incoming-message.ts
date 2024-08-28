import {Readable} from 'stream';
import {isNumber} from '../../external';
import {Socket} from 'net';
import {HttpHeaderPartProps} from '../../types';
import {getOneLineFromBuffer} from '../../stream';
import {tryParseHttpHeaderPart} from './parse-header-part';

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
    this.parseBody();
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
  parseBody() {
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
