import fs from 'fs';
import path from 'path';
import {isReadable, Readable, Transform} from 'stream';
import {pipeline} from 'stream/promises';
import {ParserOptions} from './service/types';
import {getJsonParser, getMultpartParser, getOctetParser} from './parser';
import {defaultParseOptions, getCacheWriter} from './service/utils';
import {CanConvertToBuffer, getIncomingMessageData, ReadableWithMeta, toReadable} from './service/external';

/**
 * @deprecated by parseHttpBody
 * Parse http body by params provided on http header part
 * @param request
 * @param options
 * @returns undefined/null when there is no data part
 */
export async function parseBody<DataType = any>(request: ReadableWithMeta, options?: ParserOptions) {
  const mregedOptions: Required<ParserOptions> = {
    ...defaultParseOptions,
    ...(options ?? {}),
  };
  const {uploadDir} = mregedOptions;
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
    const result = getParser(reqHeaders, mregedOptions);
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
    const {'content-type': contentType} = reqHeaders;

    if (buffer.byteLength > 0) {
      if (contentType.startsWith('text')) {
        return buffer.toString() as DataType;
      }
      return buffer as DataType;
    }
    return;
  }
  const {writer, waitCacheData} = getCacheWriter(mregedOptions);
  await pipeline([request, ...parserTransforms, writer]);
  const cacheData = await waitCacheData;
  return cacheData as DataType;
}

export async function parseHttpBody<DataType = any>(request: ReadableWithMeta, options?: ParserOptions) {
  return await parseBody<DataType>(request, options);
}
/**
 * Parse any existing data
 * @param incomingMessage
 * @param options
 * @returns
 */
export async function parseHttpData<DataType = any>(
  incomingMessage: {meta: ReadableWithMeta['headers']; data: CanConvertToBuffer},
  options?: ParserOptions
) {
  const {meta, data} = incomingMessage;
  let reader: Readable;

  if (isReadable(data as Readable)) {
    reader = data as Readable;
  } else {
    reader = toReadable(data);
  }
  // @ts-ignore
  reader.headers = meta;
  return await parseHttpBody<DataType>(reader as ReadableWithMeta, options);
}

export * from './service/types';
