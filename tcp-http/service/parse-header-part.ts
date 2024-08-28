import {Socket} from 'net';
import {Readable} from 'stream';
import {HttpHeaderPartProps, HttpFirstLineProps} from '../../types';
import {httpFirstLineReg, httpHeaderLineReg} from '../../constants';
import {getDataFromReadable, getOneLineFromBuffer, getOneLineFromReader} from '../../stream';

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
  return {headerPartProps, dataConsumed};
}
