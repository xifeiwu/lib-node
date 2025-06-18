import {Readable} from 'stream';
import {ParsedInfoWithDataConsumed} from '../../../../types';
import {getOneLineFromReader} from '../../../../stream';
import {REG_HTTP_HEADER} from '../../../../external';
import {IncomingHttpHeaders} from 'http';

export async function tryParseHttpHeaders<T extends Readable>(
  reader: T
): Promise<ParsedInfoWithDataConsumed<IncomingHttpHeaders>> {
  const headers: IncomingHttpHeaders = {};
  let dataConsumed: Buffer = Buffer.alloc(0);
  let lineBuffer: Buffer;
  while ((lineBuffer = await getOneLineFromReader(reader))) {
    dataConsumed = Buffer.concat([dataConsumed, lineBuffer]);
    const line = lineBuffer.toString('utf-8').trim().replace(/\r\n$/, '');
    if (line === '') {
      break;
    }
    const execResult = REG_HTTP_HEADER.exec(line);
    if (!execResult) {
      throw new Error(`Format error for http header: ${line}`);
    }
    const [part1, part2] = execResult.slice(1);
    /** For easy use, key of all fields will convert to lower case. */
    const field = part1.toLowerCase();
    const value: string = part2;
    // if (['content-length'].includes(field)) {
    //   value = parseInt(part2);
    // }
    if (!Object.prototype.hasOwnProperty.call(headers, field)) {
      headers[field] = value;
    } else {
      if (!Array.isArray(headers[field])) {
        headers[field] = [headers[field]] as string[];
      }
      (headers[field] as string[]).push(value);
    }
  }
  return {info: headers, dataConsumed};
}
