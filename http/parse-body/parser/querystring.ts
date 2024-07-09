import {Transform} from 'stream';
import {GetParserFunc, ParserOptions} from '../service/types';
import {IncomingHttpHeaders} from 'http';

export const getQuerystringParser: GetParserFunc = (
  headers: IncomingHttpHeaders,
  parseOptions: ParserOptions
) => {
  const {'content-type': contentType} = headers;
  const urlencoded = /urlencoded/i.test(contentType);
  if (!urlencoded) {
    return;
  }
  const bufferList: Buffer[] = [];
  const jsonParser = new Transform({
    readableObjectMode: true,
    transform(chunk, _enc, cb) {
      bufferList.push(chunk);
      cb();
    },
    final(cb) {
      try {
        const str = Buffer.concat(bufferList).toString('ascii');
        const fields = new URLSearchParams(str);
        for (const [key, value] of fields) {
          this.push({
            key,
            value,
          });
        }
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });
  return [jsonParser];
};
