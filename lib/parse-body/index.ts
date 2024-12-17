import fs from 'fs';
import path from 'path';
import {Transform} from 'stream';
import {pipeline} from 'stream/promises';
import {IncomingMessage} from 'http';
import {ParserOptions} from './service/types';
import {getJsonParser, getMultpartParser, getOctetParser} from './parser';
import {defaultParseOptions, getCacheWriter} from './service/utils';
import {getIncomingMessageData} from './service/external';

/**
 * Parse http body by params provided on http header part
 * @param request
 * @param parserOptions
 * @returns undefined/null when there is no data part
 */
export async function parseBody(request: IncomingMessage, parserOptions?: ParserOptions) {
  const mregedParserOptions: Required<ParserOptions> = {
    ...defaultParseOptions,
    ...(parserOptions ?? {}),
  };
  const {uploadDir} = mregedParserOptions;
  /**
   * uploadDir is optional
   * but if uploadDir is set, it must exist or it's parent dir must exist, or will thown error
   */
  if (uploadDir) {
    /** Only create one level deeper dir */
    if (!fs.existsSync(uploadDir)) {
      const parentDir = path.dirname(uploadDir);
      if (fs.existsSync(parentDir)) {
        fs.mkdirSync(uploadDir);
      } else {
        throw new Error(`Path(and it's parent path) not exist: ${uploadDir}`);
      }
    }
  }
  const {headers: reqHeaders} = request;
  let parserTransforms: Transform[];
  for (const getParser of [getJsonParser, getOctetParser, getMultpartParser]) {
    const result = getParser(reqHeaders, mregedParserOptions);
    if (result) {
      parserTransforms = result;
      break;
    }
  }
  if (!parserTransforms) {
    /**
     * For request with method get, there will be not content-type on header part,
     * just return undefined other than throw Error
     */
    // throw new Error(`Parser is not found for content-type: ${reqHeaders['content-type']}`);
    const buffer = await getIncomingMessageData(request);
    if (buffer.byteLength > 0) {
      return buffer;
    }
    return;
  }
  const {writer, waitCacheData} = getCacheWriter(mregedParserOptions);
  await pipeline([request, ...parserTransforms, writer]);
  const cacheData = await waitCacheData;
  return cacheData;
}

export * from './service/types';
