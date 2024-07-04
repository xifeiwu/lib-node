import {Readable} from 'stream';
import {HttpHeaderPartProps, HttpFirstLineProps} from '../../types';
import {httpFirstLineReg, httpHeaderLineReg} from '../../constants';
import {Socket} from 'node:dgram';
import {getOneLineFromReader} from '../../stream';

interface ParseFirstLineResults {
  firstLineInfo?: HttpFirstLineProps;
  dataConsumed: Buffer;
}
export async function parseHttpFirstLine(reader: Readable): Promise<ParseFirstLineResults | null> {
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
  requestInfo: HttpHeaderPartProps;
  dataConsumed: Buffer;
}
export async function parseHttpHeaderPart<T extends Readable>(
  reader: T,
  firstLineInfo?: HttpFirstLineProps
): Promise<ParseHttpHeaderResults> {
  let requestInfo: HttpHeaderPartProps;
  // let resolve: (v: ParseHttpHeaderResults) => void;
  // let reject: (err: Error) => void;
  let dataConsumed: Buffer = Buffer.alloc(0);
  if (!firstLineInfo) {
    const parseResult = await parseHttpFirstLine(reader);
    if (!parseResult.firstLineInfo) {
      throw new Error(`Parse http first line fail`);
    }
    requestInfo = {...parseResult.firstLineInfo};
    dataConsumed = Buffer.concat([dataConsumed, parseResult.dataConsumed]);
  } else {
    requestInfo = {...firstLineInfo};
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
    if (!requestInfo['headers']) {
      requestInfo['headers'] = {};
    }
    const {headers} = requestInfo;
    const [field, value] = execResult.slice(1);
    if (!Object.prototype.hasOwnProperty.call(headers, field)) {
      headers[field] = value;
    } else {
      if (!Array.isArray(headers[field])) {
        headers[field] = [headers[field] as string];
      }
      (headers[field] as string[]).push(value);
    }
  }
  return {requestInfo, dataConsumed};
}

export class HttpIncomingMessage extends Readable {
  socket: Socket;
  constructor(socket: Socket) {
    super();
    this.socket = socket;
  }
  parseHeaderPart(socket) {}
}
