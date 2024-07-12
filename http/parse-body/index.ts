import fs from 'fs';
import path from 'path';
import {Transform} from 'stream';
import {pipeline} from 'stream/promises';
import {IncomingMessage} from 'http';
import {ParserOptions} from './service/types';
import {getRequestHeaderInfo} from '../common';
import {getMultpartParser} from './parser';
import {getJsonParser} from './parser/json';
import {defaultParseOptions, getCacheWriter} from './service/utils';
import {getOctetParser} from './parser/octet-stream';

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
  const {headers: reqHeaders} = getRequestHeaderInfo(request);
  let parserTransforms: Transform[];
  for (const getParser of [getJsonParser, getOctetParser, getMultpartParser]) {
    const result = getParser(reqHeaders, mregedParserOptions);
    if (result) {
      parserTransforms = result;
      break;
    }
  }
  if (!parserTransforms) {
    throw new Error(`Parser is not found for content-type: ${reqHeaders['content-type']}`);
  }
  const {writer, waitCacheData} = getCacheWriter(mregedParserOptions);
  await pipeline([request, ...parserTransforms, writer]);
  const cacheData = await waitCacheData;
  return cacheData;
}

export {ParserOptions};
export * from './service/types';
