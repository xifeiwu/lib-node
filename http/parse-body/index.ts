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

export async function parseBody(request: IncomingMessage, parserOptions: ParserOptions) {
  const mregedParserOptions: Required<ParserOptions> = {
    ...defaultParseOptions,
    ...parserOptions,
  };
  const {uploadDir} = mregedParserOptions;
  if (!uploadDir) {
    throw new Error(`Params of uploadDir is must to have`);
  }
  /** Only create one level deep dir */
  if (!fs.existsSync(uploadDir) && path.dirname(uploadDir)) {
    fs.mkdirSync(uploadDir);
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
