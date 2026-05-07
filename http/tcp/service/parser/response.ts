import {Readable} from 'stream';
import {
  HttpResponseFirstLineInfo,
  ParsedInfoWithDataConsumed,
  HttpResponseHeaderPartInfo,
} from '../../../../types';
import {getOneLineFromReader} from '../../../../stream';
import {REG_HTTP_RESPONSE_FIRST_LINE} from '../../../../external';
import {tryParseHttpHeaders} from './common';

export async function tryParseHttpResponseFirstLine(
  reader: Readable
): Promise<ParsedInfoWithDataConsumed<HttpResponseFirstLineInfo>> {
  const buffer = await getOneLineFromReader(reader);
  const line = buffer.toString('utf-8').trim().replace(/\r\n$/, '');
  const execResult = REG_HTTP_RESPONSE_FIRST_LINE.exec(line);
  let firstLineInfo: HttpResponseFirstLineInfo;
  if (execResult) {
    const [httpVersion, statusCode, statusMessage] = execResult.slice(1);
    firstLineInfo = {httpVersion, statusCode: parseInt(statusCode, 10), statusMessage};
  }
  return {info: firstLineInfo, dataConsumed: buffer};
}

export async function tryParseHttpResponseHeaderPart<T extends Readable>(
  reader: T,
  firstLineInfo?: HttpResponseFirstLineInfo
): Promise<ParsedInfoWithDataConsumed<HttpResponseHeaderPartInfo<'receiver'>>> {
  let headerPartProps: HttpResponseHeaderPartInfo<'receiver'>;
  let dataConsumed: Buffer = Buffer.alloc(0);
  if (!firstLineInfo) {
    const parseResult = await tryParseHttpResponseFirstLine(reader);
    if (!parseResult.info) {
      // throw new Error(`Parse http first line fail`);
      return {
        dataConsumed: parseResult.dataConsumed,
      };
    }
    headerPartProps = {...parseResult.info};
    dataConsumed = Buffer.concat([dataConsumed, parseResult.dataConsumed]);
  } else {
    headerPartProps = {...firstLineInfo};
  }
  const headersParsedResult = await tryParseHttpHeaders(reader);
  headerPartProps['headers'] = headersParsedResult.info;
  dataConsumed = Buffer.concat([dataConsumed, headersParsedResult.dataConsumed]);

  return {info: headerPartProps, dataConsumed};
}
