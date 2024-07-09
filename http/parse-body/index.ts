import fs from 'fs';
import {Readable, Transform, Writable} from 'stream';
import {pipeline} from 'stream/promises';
import {toBuffer} from './service/external';
import {IncomingMessage} from 'http';
import {ParsedItem, ParsedResult, ParsedValue, ParserOptions} from './service/types';
import {getRequestHeaderInfo} from '../common';
import {getMultpartParser} from './parser';
import {getJsonParser} from './parser/json';
import path from 'path';
import {defaultParseOptions} from './service/utils';
import {getOctetParser} from './parser/octet-stream';

export function getCacheWriter(parserOptions: ParserOptions) {
  const {encoding = 'utf-8'} = parserOptions;
  const result: ParsedResult = {};
  const writer = new Writable({
    objectMode: true,
    write(item: ParsedItem, _enc, cb) {
      for (const [key, value] of Object.entries(item)) {
        let finalValue: ParsedValue = value;
        if (Buffer.isBuffer(value)) {
          finalValue = value.toString(encoding);
        }
        if (Object.prototype.hasOwnProperty.call(result, key) && !Array.isArray(result[key])) {
          result[key] = [result[key] as ParsedValue];
        }
        if (Array.isArray(result[key])) {
          (result[key] as Array<ParsedValue>).push(finalValue);
        } else {
          result[key] = finalValue;
        }
      }
      cb && cb();
    },
    final(cb) {
      cb && cb();
    },
  });
  const waitCacheData = new Promise<ParsedResult>((res, rej) => {
    writer.on('finish', () => {
      res(result);
    });
    writer.on('error', err => {
      rej(err);
    });
  });
  return {writer, waitCacheData};
}

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
