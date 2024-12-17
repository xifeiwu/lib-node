import {IncomingHttpHeaders} from 'http';
import {Transform} from 'stream';
import FormidableError, {internalCode} from '../../service/error';
import {getFileName} from '../../service/utils';
import {GetParserFunc, ParserOptions} from '../../service/types';
import {MultipartParser} from './parser';
import {FileParser} from '../../service/file-parser';

function getTransformForParser(parseOptions: Required<ParserOptions>) {
  const {encoding = 'utf-8'} = parseOptions;
  let headerField: string;
  let headerValue: string;
  let part: FileParser;
  const transformParserData = new Transform({
    objectMode: true,
    async transform({name, buffer, start, end}, _enc, cb) {
      if (name === 'partBegin') {
        part = new FileParser(parseOptions);
        headerField = '';
        headerValue = '';
      } else if (name === 'headerField') {
        headerField += buffer.toString(encoding, start, end);
      } else if (name === 'headerValue') {
        headerValue += buffer.toString(encoding, start, end);
      } else if (name === 'headerEnd') {
        headerField = headerField.toLowerCase();
        part.updateMeta({[headerField]: headerValue});

        // matches either a quoted-string or a token (RFC 2616 section 19.5.1)
        const m = headerValue.match(
          // eslint-disable-next-line no-useless-escape
          /\bname=("([^"]*)"|([^\(\)<>@,;:\\"\/\[\]\?=\{\}\s\t/]+))/i
        );
        if (headerField === 'content-disposition') {
          if (m) {
            part.updateMeta({name: m[2] || m[3] || ''});
          }
          part.updateMeta({filename: getFileName(headerValue)});
        } else if (headerField === 'content-type') {
          part.updateMeta({contentType: headerValue});
        } else if (headerField === 'content-transfer-encoding') {
          part.updateMeta({contentTransferEncoding: headerValue.toLowerCase()});
        }

        headerField = '';
        headerValue = '';
      } else if (name === 'headersEnd') {
      } else if (name === 'partData') {
        switch (part.getMetaValue('contentTransferEncoding')) {
          case 'binary':
          case '7bit':
          case '8bit':
          case 'utf-8': {
            part.write(buffer.slice(start, end));
            break;
          }
          case 'base64': {
            part.write(Buffer.from(buffer.slice(start, end).toString('ascii')));
            break;
          }
          default:
            return cb(
              new FormidableError('unknown transfer-encoding', internalCode.unknownTransferEncoding, 501)
            );
        }
      } else if (name === 'partEnd') {
        this.push(await part.end());
      } else if (name === 'end') {
        this.push(null);
      }
      cb();
    },
  });
  return transformParserData;
}

export const getMultpartParser: GetParserFunc = (
  headers: IncomingHttpHeaders,
  parseOptions: Required<ParserOptions>
) => {
  /** content-type:multipart/form-data; boundary=----WebKitFormBoundaryE7DpP5ncpQWn8RRu */
  const {'content-type': contentType} = headers;
  const multipart = /multipart/i.test(contentType);
  if (!multipart) {
    return;
  }
  const execResult = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!execResult) {
    throw new FormidableError(
      'bad content-type header, no multipart boundary',
      internalCode.missingMultipartBoundary,
      400
    );
  }
  const boundaryStr = execResult[1] || execResult[2];

  return [new MultipartParser({boundaryStr}), getTransformForParser(parseOptions)];
};
