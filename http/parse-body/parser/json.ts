import {Transform} from 'stream';
import {GetParserFunc, ParserOptions} from '../service/types';
import {IncomingHttpHeaders} from 'http';

export const getJsonParser: GetParserFunc = (headers: IncomingHttpHeaders, parseOptions: ParserOptions) => {
  const {'content-type': contentType} = headers;
  const json = /json/i.test(contentType);
  if (!json) {
    return;
  }
  const {encoding = 'utf-8'} = parseOptions;
  const bufferList: Buffer[] = [];
  const jsonParser = new Transform({
    readableObjectMode: true,
    transform(chunk, _enc, cb) {
      bufferList.push(chunk);
      cb();
    },
    final(cb) {
      try {
        const obj = JSON.parse(Buffer.concat(bufferList).toString(encoding));
        this.push(obj);
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });
  return [jsonParser];
};
