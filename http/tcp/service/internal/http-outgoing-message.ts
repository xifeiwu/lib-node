import {convertKeyToLowerCase, isNumber} from '../../../../external';
import {Socket} from 'net';
import {
  CanConvertToBuffer,
  HttpRequestHeaderPartInfo,
  HttpRequestInfo,
  HttpRequestOptions,
} from '../../../../types';
import {OutgoingHttpHeaders} from 'http';
import {convertToBuffer} from '../../../../transform';
import {httpRequestHeaderPartInfoToBuffer} from '../convert';
import {inferContentTypeByData} from '../common';
import EventEmitter from 'events';
import {Transform} from 'stream';

export class HttpOutgoingMessage extends EventEmitter {
  socket: Socket;
  headerPartInfo: HttpRequestHeaderPartInfo<'sender'>;
  _headers: OutgoingHttpHeaders;
  headerSent: boolean;
  constructor(socket: Socket, headerPartInfo: HttpRequestHeaderPartInfo<'sender'>) {
    super();
    this.socket = socket;
    this._headers = convertKeyToLowerCase(headerPartInfo.headers) ?? {};
  }
  setHeader(name: string, value: number | string | Array<string>) {
    this._headers[name] = value;
  }
  _sendHeader() {
    const buf = httpRequestHeaderPartInfoToBuffer({
      ...this.headerPartInfo,
      headers: this._headers,
    });
    this.socket.write(buf);
  }
  getHeader(name: string) {
    return this._headers[name];
  }
  getHeaders() {
    return this._headers;
  }
  headerIsUndefined(name: string) {
    return this.getHeader(name) === undefined;
  }
  // _write() {}
  write(data: CanConvertToBuffer) {
    if (!this.socket.writable) {
      return false;
    }
    if (!this.headerSent) {
      this.setHeader('transfer-encoding', 'chunked');
      this._sendHeader();
      this.headerSent = true;
    }
    this.socket.write(convertToBuffer(data));
  }
  end(data: CanConvertToBuffer) {
    const buffer = convertToBuffer(data);
    const length = buffer.byteLength;
    if (!this.headerSent) {
      this.headerIsUndefined('content-length') && this.setHeader('content-length', buffer.byteLength);
      length > 0 &&
        this.headerIsUndefined('content-type') &&
        this.setHeader('content-type', inferContentTypeByData(data));
      this._sendHeader();
      this.headerSent = true;
    }
    this.socket.write(buffer);
  }
}
