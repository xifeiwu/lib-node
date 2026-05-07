import {Readable} from 'stream';
import {
  HttpRequestHeaderPartInfo,
  HttpRequestFirstLineInfo,
  ParsedInfoWithDataConsumed,
} from '../../../../types';
import {getOneLineFromReader} from '../../../../stream';
import {REG_HTTP_REQUEST_FIRST_LINE} from '../../../../external';
import {tryParseHttpHeaders} from './common';

export async function tryParseHttpRequestFirstLine(
  reader: Readable
): Promise<ParsedInfoWithDataConsumed<HttpRequestFirstLineInfo>> {
  const buffer = await getOneLineFromReader(reader);
  const line = buffer.toString('utf-8').trim().replace(/\r\n$/, '');
  const execResult = REG_HTTP_REQUEST_FIRST_LINE.exec(line);
  let firstLineInfo: HttpRequestFirstLineInfo;
  if (execResult) {
    const [method, url, httpVersion] = execResult.slice(1);
    firstLineInfo = {method, url, httpVersion};
  }
  return {info: firstLineInfo, dataConsumed: buffer};
}

export async function tryParseHttpRequestHeaderPart<T extends Readable>(
  reader: T,
  firstLineInfo?: HttpRequestFirstLineInfo
): Promise<ParsedInfoWithDataConsumed<HttpRequestHeaderPartInfo<'receiver'>>> {
  let headerPartProps: HttpRequestHeaderPartInfo<'receiver'>;
  let dataConsumed: Buffer = Buffer.alloc(0);
  if (!firstLineInfo) {
    const parseResult = await tryParseHttpRequestFirstLine(reader);
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
