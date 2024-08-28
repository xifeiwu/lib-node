import {Socket} from 'net';
import {Readable} from 'stream';
import {EventEmitter} from 'events';

export class HttpHandler extends EventEmitter {
  socket: Readable;
  constructor(socket: Readable) {
    super();
    this.socket = socket;
  }
}
