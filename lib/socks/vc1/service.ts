import {SocksVersion} from '../types';
import {BinaryLike} from 'crypto';
import {isFunction, toBuffer, xorData} from '../service/external';
import {Duplex} from 'stream';
import net, {Socket} from 'net';
import {NegotiationResult} from '../types/vc1';

export const PROTOCOL_BYTE: SocksVersion = 1;

export const clientState = {
  sentConnectionInfo: 'sent connection info',
  gotRepliedTargetServiceInfo: 'got replied target service info',
};

export const defaultIvBytes = 1;

export function encrypt(data: Buffer, iv: BinaryLike) {
  return xorData(data, iv);
}
export function decript(data: Buffer, iv: BinaryLike) {
  return xorData(data, iv);
}

export function getWrappedSocket(socket: Socket, info: NegotiationResult): Socket {
  return new EncryptedSocket(socket, info);
}
export class EncryptedSocket extends Duplex implements Socket {
  socket: Socket;
  iv: NegotiationResult['iv'];
  constructor(socket: Socket, config: Pick<NegotiationResult, 'iv'>) {
    super({
      allowHalfOpen: socket.allowHalfOpen,
      // readable: socket.readable,
      // writable: socket.writable,
    });
    this.socket = socket;
    const {iv} = config;
    this.iv = iv;
    this.listenData();
  }
  beforePush(chunk: Buffer) {
    const buf = toBuffer(chunk);
    const result = xorData(buf, this.iv);
    const origin = xorData(result, this.iv);
    return result;
  }
  beforeWrite(chunk: string | Buffer) {
    const buf = toBuffer(chunk);
    const result = xorData(buf, this.iv);
    // const origin = xorData(result, this.iv);
    return result;
  }
  listenData() {
    const {socket} = this;
    socket.on('data', chunk => {
      this.push(this.beforePush(chunk));
    });
  }
  _read() {}
  public write(buffer: Uint8Array | string, cb?: (err?: Error) => void): boolean;
  public write(str: Uint8Array | string, encoding?: BufferEncoding, cb?: (err?: Error) => void): boolean;
  write(
    chunk: string | Buffer,
    encoding?: BufferEncoding | ((err?: Error) => void),
    cb?: (err?: Error) => void
  ) {
    const {socket} = this;
    if (isFunction(encoding) && !isFunction(cb)) {
      cb = encoding as (err?: Error) => void;
      encoding = undefined;
    }
    return socket.write(this.beforeWrite(chunk), cb);
  }
  public bufferSize: number;
  public bytesRead: number;
  public bytesWritten: number;
  public connecting: boolean;
  public pending: boolean;
  public localFamily?: string;
  public readyState: net.SocketReadyState;
  public autoSelectFamilyAttemptedAddresses: string[];
  // public remoteAddress?: string;
  get remoteAddress() {
    return this.socket?.remoteAddress;
  }
  get remotePort() {
    return this.socket?.remotePort;
  }
  get localAddress() {
    return this.socket?.localAddress;
  }
  get localPort() {
    return this.socket?.localPort;
  }
  public remoteFamily?: string;
  public timeout?: number;
  public connect(port: unknown, host?: unknown, connectionListener?: unknown): this {
    throw new Error('Method not implemented.');
  }
  public resetAndDestroy(): this {
    throw new Error('Method not implemented.');
  }
  public setTimeout(timeout: number, callback?: () => void): this {
    throw new Error('Method not implemented.');
  }
  public setNoDelay(noDelay?: boolean): this {
    throw new Error('Method not implemented.');
  }
  public setKeepAlive(enable?: boolean, initialDelay?: number): this {
    throw new Error('Method not implemented.');
  }
  public address(): net.AddressInfo | {} {
    throw new Error('Method not implemented.');
  }
  public unref(): this {
    throw new Error('Method not implemented.');
  }
  public ref(): this {
    throw new Error('Method not implemented.');
  }
  public destroySoon(): this {
    throw new Error('Method not implemented.');
  }
}
