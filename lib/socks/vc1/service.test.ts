import {Duplex, Readable} from 'stream';
import {CanConvertToBuffer, getXorDataFunc, getXorTransform} from '../service/external';
import {getCustomizedDuplex, watchDuplexState} from '../../../stream';

class EncryptedSocket extends Duplex {
  socket: Duplex;
  iv: Buffer;
  xorData4Write: (chunk: CanConvertToBuffer) => Buffer;
  constructor(socket: Duplex) {
    super({
      // allowHalfOpen: socket.allowHalfOpen,
      // readable: socket.readable,
      // writable: socket.writable,
    });
    this.socket = socket;
    // this.iv = convertToBuffer(iv);
    this.iv = Buffer.alloc(32).fill(0);
    this.converReaderData(this.socket, this.iv);
    this.xorData4Write = getXorDataFunc(this.iv);
  }
  converReaderData(reader: Readable, iv: Buffer) {
    reader.pipe(getXorTransform(iv, this));
  }
  _read() {}
  _write(chunk: string | Buffer, encoding?: BufferEncoding, cb?: (err?: Error) => void) {
    return this.socket.write(this.xorData4Write(chunk), encoding, cb);
  }
}

export async function testState() {
  const clientSocket = getCustomizedDuplex({
    customize: {
      read: {source: 'number', generateCount: 5, delay: 300},
      color: 'blue',
    },
    allowHalfOpen: false,
  });
  watchDuplexState(clientSocket, {logPrefix: 'clientSocket ', printState: true, color: 'blue'});

  const es = new EncryptedSocket(clientSocket);
  watchDuplexState(es, {logPrefix: 'EncryptedSocket ', printState: true, color: 'magenta'});

  const remoteSocket = getCustomizedDuplex({
    customize: {
      read: {source: 'word', generateCount: 5, delay: 300},
      color: 'red',
    },
    allowHalfOpen: false,
  });
  watchDuplexState(remoteSocket, {logPrefix: 'remoteSocket ', printState: true, color: 'red'});

  remoteSocket.pipe(es).pipe(remoteSocket);
}
