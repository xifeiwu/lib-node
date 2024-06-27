import fs from 'fs';
import {Readable, Transform, Writable} from 'stream';
import {pipeline} from 'stream/promises';
import {toBuffer} from './service/external';
import {IncomingMessage} from 'http';
import {ParsedItem, ParsedResult, ParsedValue, ParserOptions} from './service/types';
import {getRequestHeaderInfo} from '../common';
import {getMultpartParser} from './parser';

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
  parserOptions = {encoding: 'utf-8', ...parserOptions};
  const {uploadDir} = parserOptions;
  if (!uploadDir || !fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  const reqHeaderInfo = getRequestHeaderInfo(request);
  let parserTransforms: Transform[];
  for (const getParser of [getMultpartParser]) {
    const result = getParser(reqHeaderInfo.headers, parserOptions);
    if (result) {
      parserTransforms = result;
      break;
    }
  }
  if (!parserTransforms) {
    throw new Error(`parser is not found`);
  }
  const {writer, waitCacheData} = getCacheWriter(parserOptions);
  await pipeline([request, ...parserTransforms, writer]);
  const cacheData = await waitCacheData;
  return cacheData;
}
