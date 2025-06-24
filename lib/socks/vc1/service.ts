import {SocksVersion} from '../types';
import {BinaryLike} from 'crypto';
import {
  CanConvertToBuffer,
  convertToBuffer,
  getXorDataFunc,
  getXorTransform,
  xorData,
} from '../service/external';
import {Duplex, Readable} from 'stream';
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

export function getWrappedSocket(socket: Socket, info: NegotiationResult) {
  const wrappedSocket = new EncryptedSocket(socket, info);
  return wrappedSocket as unknown as Socket;
}
class EncryptedSocket extends Duplex {
  socket: Socket;
  iv: Buffer;
  xorData4Write: (chunk: CanConvertToBuffer) => Buffer;
  constructor(socket: Socket, config: Pick<NegotiationResult, 'iv'>) {
    super({
      // allowHalfOpen: socket.allowHalfOpen,
      // readable: socket.readable,
      // writable: socket.writable,
    });
    this.socket = socket;
    const {iv} = config;
    this.iv = convertToBuffer(iv);
    this.converReaderData(this.socket, this.iv);
    this.xorData4Write = getXorDataFunc(this.iv);
  }
  converReaderData(reader: Readable, iv: Buffer) {
    reader.pipe(getXorTransform(iv, this));
    reader.once('end', () => {
      this.push(null);
    });
  }
  _read() {}
  _write(chunk: string | Buffer, encoding?: BufferEncoding, cb?: (err?: Error) => void) {
    return this.socket.write(this.xorData4Write(chunk), encoding, cb);
  }
  _final(cb: (error?: Error | null) => void): void {
    if (this.socket.writable) {
      this.socket.end(cb);
    }
  }
  get localAddress() {
    return this.socket?.localAddress;
  }
  get localPort() {
    return this.socket?.localPort;
  }
  get remoteAddress() {
    return this.socket?.remoteAddress;
  }
  get remotePort() {
    return this.socket?.remotePort;
  }
  // get readable() {
  //   return this.socket?.readable;
  // }
  // get readableFlowing() {
  //   return this.socket?.readableFlowing;
  // }
  // get readyState() {
  //   return this.socket?.readyState;
  // }
  // get writable() {
  //   return this.socket?.writable;
  // }
  // get localAddress() {
  //   return this.socket?.localAddress;
  // }
  // get localAddress() {
  //   return this.socket?.localAddress;
  // }
  // get localAddress() {
  //   return this.socket?.localAddress;
  // }
  // get localAddress() {
  //   return this.socket?.localAddress;
  // }
  // bytesWritten,
  // destroyed,
  // bytesRead,
  // allowHalfOpen,
}
